import { S3Client, DeleteObjectsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const MAX_UPLOAD_BYTES = 150 * 1024; // client targets <100KB; 150KB is the hard ceiling

let cached: S3Client | null = null;

function r2(): S3Client {
  if (cached) return cached;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY');
  }

  cached = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return cached;
}

function bucket(): string {
  const b = process.env.R2_BUCKET;
  if (!b) throw new Error('Missing R2_BUCKET');
  return b;
}

/** Public base URL of the bucket (r2.dev subdomain or a custom CDN domain). */
export function publicUrlFor(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) throw new Error('Missing R2_PUBLIC_BASE_URL');
  return `${base.replace(/\/+$/, '')}/${key}`;
}

/** Only these two encoders are ever produced by the client pipeline. */
export const ALLOWED_PHOTO_TYPES = ['image/webp', 'image/jpeg'] as const;
export type PhotoType = (typeof ALLOWED_PHOTO_TYPES)[number];

export function buildPhotoKey(partyCode: string, contentType: PhotoType): string {
  const rand = crypto.randomUUID().replace(/-/g, '');
  const ext = contentType === 'image/jpeg' ? 'jpg' : 'webp';
  const safeCode = partyCode.toLowerCase().replace(/[^a-z0-9-]/g, '');
  return `parties/${safeCode}/${rand}.${ext}`;
}

/**
 * Presigned PUT for a single selfie. Content-Type and Content-Length are both
 * signed, so the browser cannot upload a different type or a bigger file than
 * the one we approved.
 */
export async function presignSelfieUpload(
  key: string,
  contentLength: number,
  contentType: PhotoType,
) {
  if (!Number.isInteger(contentLength) || contentLength <= 0) {
    throw new Error('Invalid content length');
  }
  if (contentLength > MAX_UPLOAD_BYTES) {
    throw new Error(`Photo too large (${contentLength} B, max ${MAX_UPLOAD_BYTES} B)`);
  }

  const command = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(r2(), command, { expiresIn: 120 });
  return { uploadUrl, key, publicUrl: publicUrlFor(key) };
}

/** Hard-delete objects. Used by "delete my profile" and by the TTL worker. */
export async function deleteObjects(keys: string[]): Promise<number> {
  const clean = keys.filter(Boolean);
  if (clean.length === 0) return 0;

  let deleted = 0;
  for (let i = 0; i < clean.length; i += 1000) {
    const batch = clean.slice(i, i + 1000);
    const res = await r2().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: batch.map((Key) => ({ Key })), Quiet: true },
      }),
    );
    deleted += batch.length - (res.Errors?.length ?? 0);
  }
  return deleted;
}
