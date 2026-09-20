'use client';

import { Flag, Heart, HeartCrack } from 'lucide-react';
import {
  LOOKING_FOR_LABELS,
  RELATIONSHIP_LABELS,
  type DeckProfile,
} from '@/lib/types';

const STATUS_TONE: Record<string, string> = {
  single: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
  taken: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
  complicated: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
};

interface Props {
  profile: DeckProfile;
  onReport?: (profile: DeckProfile) => void;
  /** Set on the card the user is currently dragging. */
  interactive?: boolean;
}

export default function ProfileCard({ profile, onReport, interactive = false }: Props) {
  return (
    <article className="relative h-full w-full overflow-hidden rounded-[28px] border border-white/10 bg-zinc-900 shadow-2xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profile.photo_url}
        alt={`${profile.first_name}, ${profile.age}`}
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
        loading="eager"
        decoding="async"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

      {interactive && onReport && (
        <button
          type="button"
          onClick={() => onReport(profile)}
          aria-label="Zgłoś ten profil"
          className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/45 p-2.5 text-zinc-300 backdrop-blur transition active:scale-90"
        >
          <Flag className="h-4 w-4" />
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 p-5">
        <div className="flex items-end gap-2">
          <h2 className="text-3xl font-bold leading-none tracking-tight">{profile.first_name}</h2>
          <span className="pb-0.5 text-xl font-light text-zinc-300">{profile.age}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              STATUS_TONE[profile.relationship_status] ?? STATUS_TONE.single
            }`}
          >
            {RELATIONSHIP_LABELS[profile.relationship_status]}
          </span>
          <span className="rounded-full border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold text-violet-200">
            {LOOKING_FOR_LABELS[profile.looking_for]}
          </span>
        </div>

        {profile.bio && (
          <p className="mt-3 text-sm leading-snug text-zinc-200">{profile.bio}</p>
        )}

        {profile.hobbies.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.hobbies.map((h) => (
              <span
                key={h}
                className="rounded-full border border-white/10 bg-white/10 px-2.5 py-1 text-[11px] text-zinc-200 backdrop-blur"
              >
                {h}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

/** LIKE / NOPE stamps that fade in as the top card is dragged. */
export function SwipeStamp({ kind }: { kind: 'like' | 'pass' }) {
  const like = kind === 'like';
  return (
    <div
      className={`flex items-center gap-2 rounded-2xl border-[3px] px-4 py-2 text-2xl font-black uppercase tracking-widest backdrop-blur-sm ${
        like
          ? 'border-emerald-400 text-emerald-300 shadow-glow-emerald'
          : 'border-rose-400 text-rose-300'
      }`}
    >
      {like ? <Heart className="h-6 w-6" /> : <HeartCrack className="h-6 w-6" />}
      {like ? 'Tak' : 'Nie'}
    </div>
  );
}
