'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Eye, Heart, Search, Sparkles } from 'lucide-react';
import { LOOKING_FOR_LABELS, type MatchEntry, type Party } from '@/lib/types';

/**
 * The whole point of PartyMatch: there is no chat. When two people match, the
 * app tells them to go find each other, and hands over the only two things
 * that help with that — the face and whatever hint is in the bio.
 */
export default function MatchScreen({
  match,
  party,
  myPhotoUrl,
  onClose,
}: {
  match: MatchEntry;
  party: Party;
  myPhotoUrl?: string;
  onClose: () => void;
}) {
  const other = match.profile;

  // A short buzz is the only notification we can give without push permissions.
  useEffect(() => {
    try {
      navigator.vibrate?.([40, 60, 40, 60, 120]);
    } catch {
      /* unsupported */
    }
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] overflow-y-auto bg-zinc-950/95 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 30%, rgba(168,85,247,0.35), transparent 60%)',
        }}
      />

      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center px-6 py-10 text-center">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/40 bg-violet-500/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-violet-200">
            <Sparkles className="h-3.5 w-3.5" />
            To jest match
          </div>
        </motion.div>

        <h1 className="mt-5 text-4xl font-black leading-tight">
          Ty i {other.first_name}
          <br />
          <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
            polubiliście się
          </span>
        </h1>

        {/* Two faces, overlapping, with a heart in the middle. */}
        <div className="relative mt-8 flex items-center justify-center">
          {myPhotoUrl && (
            <motion.img
              initial={{ x: -30, opacity: 0, rotate: -12 }}
              animate={{ x: 0, opacity: 1, rotate: -7 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 20 }}
              src={myPhotoUrl}
              alt="Ty"
              className="h-40 w-32 rounded-3xl border-2 border-white/15 object-cover shadow-2xl"
            />
          )}
          <motion.img
            initial={{ x: 30, opacity: 0, rotate: 12 }}
            animate={{ x: myPhotoUrl ? -18 : 0, opacity: 1, rotate: 7 }}
            transition={{ delay: 0.16, type: 'spring', stiffness: 220, damping: 20 }}
            src={other.photo_url}
            alt={other.first_name}
            className="h-40 w-32 rounded-3xl border-2 border-white/15 object-cover shadow-2xl"
          />
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.34, type: 'spring', stiffness: 320, damping: 14 }}
            className="absolute flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-glow"
          >
            <Heart className="h-7 w-7 fill-white text-white" />
          </motion.span>
        </div>

        {/* The instruction that replaces a chat. */}
        <div className="pm-card mt-8 w-full p-5 text-left">
          <div className="flex items-center gap-2 text-emerald-300">
            <Search className="h-4 w-4" />
            <h2 className="text-xs font-bold uppercase tracking-[0.18em]">
              Znajdźcie się w tłumie
            </h2>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Nie ma tu czatu — {other.first_name} jest teraz na{' '}
            <span className="font-semibold text-zinc-100">{party.name}</span>
            {party.venue ? `, ${party.venue}` : ''}. Rozejrzyj się, zapamiętaj twarz i podejdź.
          </p>

          {other.bio && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                <Eye className="h-3 w-3" />
                Wskazówka od {other.first_name}
              </div>
              <p className="text-sm italic leading-snug text-zinc-200">„{other.bio}”</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
              {LOOKING_FOR_LABELS[other.looking_for]}
            </span>
            {other.hobbies.map((h) => (
              <span
                key={h}
                className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300"
              >
                {h}
              </span>
            ))}
          </div>
        </div>

        <button type="button" onClick={onClose} className="pm-btn-primary mt-6 w-full py-4 text-base">
          Swipuję dalej
        </button>

        <p className="mt-4 text-[11px] leading-relaxed text-zinc-500">
          Ten match znajdziesz w zakładce „Matche” do końca imprezy. Bądźcie dla siebie mili
          i szanujcie odmowę.
        </p>
      </div>
    </motion.div>
  );
}
