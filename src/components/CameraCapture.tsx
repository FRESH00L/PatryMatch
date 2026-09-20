'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, RotateCcw, SwitchCamera, ImageUp, Loader2, AlertTriangle } from 'lucide-react';
import {
  captureFromVideo,
  compressImageFile,
  formatBytes,
  type CapturedPhoto,
} from '@/lib/image';

interface Props {
  /** Called once the user accepts the shot. */
  onAccept: (photo: CapturedPhoto) => void;
  title?: string;
  subtitle?: string;
  ctaLabel?: string;
}

type Phase = 'starting' | 'live' | 'review' | 'blocked';

/**
 * One shot, taken here and now — that is the whole premise of the app, so the
 * live camera is the primary path and the file picker only appears when
 * getUserMedia is unavailable (iOS in-app browsers, permission denied).
 */
export default function CameraCapture({
  onAccept,
  title = 'Zrób selfie',
  subtitle = 'Jedno zdjęcie, teraz. Możesz je zaakceptować albo powtórzyć.',
  ctaLabel = 'Użyj tego zdjęcia',
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('starting');
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async () => {
    stopStream();
    setError(null);
    setPhase('starting');

    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('blocked');
      setError('Ta przeglądarka nie udostępnia aparatu. Użyj wgrywania zdjęcia.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1080 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setPhase('live');
    } catch {
      setPhase('blocked');
      setError('Brak dostępu do aparatu. Zezwól na kamerę w ustawieniach przeglądarki.');
    }
  }, [facing, stopStream]);

  useEffect(() => {
    void startStream();
    return stopStream;
  }, [startStream, stopStream]);

  // NB: the preview object URL is deliberately *not* revoked on unmount — the
  // parent keeps showing it as a thumbnail after accepting. It is revoked in
  // `retake()`, and by the parent when it swaps the photo out.

  async function shoot() {
    if (!videoRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      const shot = await captureFromVideo(videoRef.current, facing === 'user');
      stopStream();
      setPhoto(shot);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zrobić zdjęcia.');
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      const shot = await compressImageFile(file);
      stopStream();
      setPhoto(shot);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wczytać zdjęcia.');
    } finally {
      setBusy(false);
    }
  }

  function retake() {
    if (photo) URL.revokeObjectURL(photo.previewUrl);
    setPhoto(null);
    void startStream();
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-1.5 text-sm text-zinc-400">{subtitle}</p>
      </header>

      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-glow">
        <AnimatePresence mode="wait">
          {phase === 'review' && photo ? (
            <motion.img
              key="review"
              src={photo.previewUrl}
              alt="Podgląd Twojego zdjęcia"
              initial={{ opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full object-cover"
            />
          ) : (
            <motion.video
              key="live"
              ref={videoRef}
              playsInline
              muted
              autoPlay
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === 'live' ? 1 : 0.25 }}
              className="h-full w-full object-cover"
              style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
            />
          )}
        </AnimatePresence>

        {/* Framing guide */}
        {phase === 'live' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-[58%] w-[70%] rounded-[42%] border-2 border-white/25" />
          </div>
        )}

        {phase === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-400">
            <Loader2 className="h-7 w-7 animate-spin" />
            <p className="text-sm">Uruchamiam aparat…</p>
          </div>
        )}

        {phase === 'blocked' && !photo && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 text-center text-zinc-400">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <p className="text-sm">Aparat niedostępny.</p>
          </div>
        )}

        {phase === 'live' && (
          <button
            type="button"
            onClick={() => setFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            aria-label="Przełącz aparat"
            className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/50 p-2.5 backdrop-blur"
          >
            <SwitchCamera className="h-5 w-5" />
          </button>
        )}

        {photo && (
          <span className="absolute bottom-3 left-3 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-emerald-300 backdrop-blur">
            {photo.width}×{photo.height} · WebP · {formatBytes(photo.bytes)}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {error}
        </p>
      )}

      {phase === 'review' && photo ? (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={retake} className="pm-btn-ghost">
            <RotateCcw className="h-4 w-4" />
            Powtórz
          </button>
          <button type="button" onClick={() => onAccept(photo)} className="pm-btn-primary">
            <Check className="h-4 w-4" />
            {ctaLabel}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={shoot}
            disabled={phase !== 'live' || busy}
            className="pm-btn-primary py-4 text-base"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            Zrób zdjęcie
          </button>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="pm-btn-ghost text-xs"
          >
            <ImageUp className="h-4 w-4" />
            Aparat nie działa? Wgraj zdjęcie
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={pickFile}
            className="hidden"
          />
        </div>
      )}

      <p className="text-center text-[11px] leading-relaxed text-zinc-500">
        Zdjęcie jest kompresowane w Twojej przeglądarce (WebP, maks. 720×960, &lt;100&nbsp;KB)
        i wysyłane bezpośrednio do zaszyfrowanego magazynu. Znika razem z imprezą.
      </p>
    </div>
  );
}
