'use client';

/**
 * Client-side selfie pipeline.
 *
 *   <video> frame  ->  center-cropped 3:4 canvas  ->  WebP (quality search)
 *                  ->  presigned PUT straight to Cloudflare R2
 *
 * Nothing but the finished <100KB WebP ever leaves the device, and it never
 * transits our own servers — the browser talks to R2 directly.
 */

export const TARGET_W = 720;
export const TARGET_H = 960; // 3:4 portrait
export const TARGET_BYTES = 100 * 1024; // hard budget: 100 KB
export const HARD_MAX_BYTES = 150 * 1024; // server refuses to presign above this

const QUALITY_LADDER = [0.86, 0.78, 0.7, 0.62, 0.54, 0.46, 0.38, 0.3];
const DIMENSION_LADDER = [1, 0.85, 0.7, 0.55];

export interface CapturedPhoto {
  blob: Blob;
  /** Object URL for the preview step — revoke it when you are done. */
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Feature-detect real WebP encoding; Safari <14 silently falls back to PNG. */
function supportsWebP(): boolean {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.toDataURL('image/webp').startsWith('data:image/webp');
}

/**
 * Draws `source` center-cropped ("cover") into a 3:4 canvas at `scale` of the
 * target size. Mirrors horizontally so the selfie matches what the user saw.
 */
function drawCover(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  scale: number,
  mirror: boolean,
): HTMLCanvasElement {
  const outW = Math.round(TARGET_W * scale);
  const outH = Math.round(TARGET_H * scale);

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2D niedostępny w tej przeglądarce.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Cover-crop maths
  const srcRatio = srcW / srcH;
  const dstRatio = outW / outH;
  let sx = 0;
  let sy = 0;
  let sw = srcW;
  let sh = srcH;

  if (srcRatio > dstRatio) {
    sw = srcH * dstRatio;
    sx = (srcW - sw) / 2;
  } else {
    sh = srcW / dstRatio;
    sy = (srcH - sh) / 2;
  }

  if (mirror) {
    ctx.translate(outW, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, outW, outH);
  return canvas;
}

/**
 * Encodes to WebP under TARGET_BYTES, walking quality down first and only
 * shrinking dimensions if quality alone cannot get there.
 */
async function encodeUnderBudget(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  mirror: boolean,
): Promise<CapturedPhoto> {
  const mime = supportsWebP() ? 'image/webp' : 'image/jpeg';
  let smallest: { blob: Blob; w: number; h: number } | null = null;

  for (const scale of DIMENSION_LADDER) {
    const canvas = drawCover(source, srcW, srcH, scale, mirror);

    for (const q of QUALITY_LADDER) {
      const blob = await canvasToBlob(canvas, mime, q);
      if (!blob) continue;

      if (!smallest || blob.size < smallest.blob.size) {
        smallest = { blob, w: canvas.width, h: canvas.height };
      }
      if (blob.size <= TARGET_BYTES) {
        return {
          blob,
          previewUrl: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
          bytes: blob.size,
        };
      }
    }
  }

  if (!smallest) throw new Error('Nie udało się zakodować zdjęcia.');
  if (smallest.blob.size > HARD_MAX_BYTES) {
    throw new Error('Zdjęcie jest zbyt duże. Spróbuj przy lepszym oświetleniu.');
  }
  return {
    blob: smallest.blob,
    previewUrl: URL.createObjectURL(smallest.blob),
    width: smallest.w,
    height: smallest.h,
    bytes: smallest.blob.size,
  };
}

/** Grabs the current frame of a live <video> and compresses it. */
export async function captureFromVideo(video: HTMLVideoElement, mirror = true): Promise<CapturedPhoto> {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) throw new Error('Kamera nie jest jeszcze gotowa.');
  return encodeUnderBudget(video, w, h, mirror);
}

/** Fallback path: <input type="file" capture="user"> on locked-down browsers. */
export async function compressImageFile(file: File): Promise<CapturedPhoto> {
  const bitmapSupported = typeof createImageBitmap === 'function';

  if (bitmapSupported) {
    const bitmap = await createImageBitmap(file);
    try {
      return await encodeUnderBudget(bitmap, bitmap.width, bitmap.height, false);
    } finally {
      bitmap.close();
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Nie udało się odczytać zdjęcia.'));
      el.src = url;
    });
    return await encodeUnderBudget(img, img.naturalWidth, img.naturalHeight, false);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface UploadedPhoto {
  photoKey: string;
  photoUrl: string;
}

/**
 * Asks our API for a short-lived presigned PUT, then uploads straight to R2.
 * `sessionToken` is only needed when replacing an existing photo.
 */
export async function uploadSelfie(
  photo: CapturedPhoto,
  partyCode: string,
  sessionToken?: string,
): Promise<UploadedPhoto> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (sessionToken) headers['x-session-token'] = sessionToken;

  const signRes = await fetch('/api/upload-url', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      partyCode,
      contentLength: photo.blob.size,
      contentType: photo.blob.type || 'image/webp',
    }),
  });

  if (!signRes.ok) {
    const { error } = await signRes.json().catch(() => ({ error: null }));
    throw new Error(error ?? 'Nie udało się przygotować wysyłki zdjęcia.');
  }

  const { uploadUrl, key, publicUrl } = (await signRes.json()) as {
    uploadUrl: string;
    key: string;
    publicUrl: string;
  };

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': photo.blob.type || 'image/webp' },
    body: photo.blob,
  });

  if (!putRes.ok) {
    throw new Error(`Wysyłka zdjęcia nie powiodła się (${putRes.status}).`);
  }

  return { photoKey: key, photoUrl: publicUrl };
}

export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(0)} KB`;
}
