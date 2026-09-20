'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Flag, Loader2, X } from 'lucide-react';
import { api } from '@/lib/client-session';
import type { DeckProfile } from '@/lib/types';

const REASONS = [
  'Nagość lub treści seksualne',
  'To nie jest zdjęcie tej osoby',
  'Nękanie lub mowa nienawiści',
  'Osoba niepełnoletnia',
  'Spam lub reklama',
  'Inny powód',
];

/** DSA notice-and-action sheet. Two reports hide the profile for everyone. */
export default function ReportSheet({
  profile,
  token,
  onClose,
  onReported,
}: {
  profile: DeckProfile;
  token: string;
  onClose: () => void;
  onReported: (profileId: string) => void;
}) {
  const [reason, setReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await api('/api/report', token, {
        method: 'POST',
        body: JSON.stringify({ targetId: profile.id, reason }),
      });
      onReported(profile.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać zgłoszenia.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        className="w-full max-w-md rounded-t-3xl border-t border-white/10 bg-zinc-900 p-6 pb-8"
        role="dialog"
        aria-modal="true"
        aria-label="Zgłoś profil"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 text-rose-300">
            <Flag className="h-5 w-5" />
            <h2 className="text-base font-bold">Zgłoś profil: {profile.first_name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Zamknij" className="p-1 text-zinc-500">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                reason === r
                  ? 'border-rose-400/60 bg-rose-500/15 text-rose-100'
                  : 'border-white/10 bg-white/[0.03] text-zinc-300'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          Zgłoszenie jest anonimowe. Profil natychmiast znika z Twojej talii, a po przekroczeniu
          progu zgłoszeń jest ukrywany dla wszystkich uczestników.
        </p>

        <button
          type="button"
          onClick={submit}
          disabled={!reason || busy}
          className="pm-btn mt-4 w-full bg-rose-600 py-4 text-base text-white hover:bg-rose-500"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Flag className="h-5 w-5" />}
          Wyślij zgłoszenie
        </button>
      </motion.div>
    </div>
  );
}
