'use client';

import { useEffect, useState } from 'react';
import { Heart, Loader2, Search } from 'lucide-react';
import PartyNav from '@/components/PartyNav';
import MatchScreen from '@/components/MatchScreen';
import { useProfile } from '@/components/useProfile';
import { api } from '@/lib/client-session';
import { LOOKING_FOR_LABELS, type MatchEntry, type Party } from '@/lib/types';

export default function MatchesScreen({ party }: { party: Party }) {
  const { token, profile, loading } = useProfile(party.code);
  const [matches, setMatches] = useState<MatchEntry[] | null>(null);
  const [open, setOpen] = useState<MatchEntry | null>(null);

  useEffect(() => {
    if (!token) return;
    api<{ matches: MatchEntry[] }>('/api/matches', token)
      .then(({ matches: list }) => setMatches(list))
      .catch(() => setMatches([]));
  }, [token]);

  if (loading || !token || !profile || matches === null) {
    return (
      <main className="pm-shell items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </main>
    );
  }

  return (
    <main className="pm-shell">
      <header className="mb-5">
        <h1 className="text-2xl font-bold">Twoje matche</h1>
        <p className="mt-1 text-sm text-zinc-400">
          {matches.length === 0
            ? 'Jeszcze pusto — wróć do swipowania.'
            : 'Dotknij, aby zobaczyć wskazówkę i znaleźć tę osobę na miejscu.'}
        </p>
      </header>

      {matches.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <Heart className="h-10 w-10 text-zinc-700" />
          <p className="max-w-[16rem] text-sm leading-relaxed text-zinc-500">
            Match powstaje, gdy oboje przesuniecie w prawo. Wtedy dostaniesz ekran
            „znajdźcie się w tłumie”.
          </p>
        </div>
      ) : (
        <ul className="flex-1 space-y-3">
          {matches.map((m) => (
            <li key={m.match_id}>
              <button
                type="button"
                onClick={() => setOpen(m)}
                className="pm-card flex w-full items-center gap-4 p-3 text-left transition active:scale-[0.99]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.profile.photo_url}
                  alt={m.profile.first_name}
                  className="h-20 w-16 shrink-0 rounded-2xl border border-white/10 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">
                    {m.profile.first_name}{' '}
                    <span className="font-light text-zinc-400">{m.profile.age}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-violet-300">
                    {LOOKING_FOR_LABELS[m.profile.looking_for]}
                  </p>
                  {m.profile.bio && (
                    <p className="mt-1 truncate text-xs text-zinc-400">{m.profile.bio}</p>
                  )}
                </div>
                <Search className="h-4 w-4 shrink-0 text-zinc-500" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <PartyNav partyCode={party.code} matchCount={matches.length} />

      {open && (
        <MatchScreen
          match={open}
          party={party}
          myPhotoUrl={profile.photo_url}
          onClose={() => setOpen(null)}
        />
      )}
    </main>
  );
}
