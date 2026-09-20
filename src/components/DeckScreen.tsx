'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Loader2, Users } from 'lucide-react';
import SwipeDeck from '@/components/SwipeDeck';
import MatchScreen from '@/components/MatchScreen';
import PartyNav from '@/components/PartyNav';
import { useProfile } from '@/components/useProfile';
import { api } from '@/lib/client-session';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { MatchEntry, Party } from '@/lib/types';

export default function DeckScreen({ party }: { party: Party }) {
  const { token, profile, loading } = useProfile(party.code);

  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [pending, setPending] = useState<MatchEntry[]>([]);
  const seenMatchIds = useRef(new Set<string>());

  /** Adds a match, deduping against everything already shown or listed. */
  const ingest = useCallback((entries: MatchEntry[], announce: boolean) => {
    const fresh = entries.filter((m) => !seenMatchIds.current.has(m.match_id));
    if (fresh.length === 0) return;
    fresh.forEach((m) => seenMatchIds.current.add(m.match_id));
    setMatches((prev) => [...fresh, ...prev]);
    if (announce) setPending((prev) => [...prev, ...fresh]);
  }, []);

  // Existing matches on mount — no popup for those.
  useEffect(() => {
    if (!token) return;
    api<{ matches: MatchEntry[] }>('/api/matches', token)
      .then(({ matches: list }) => ingest(list, false))
      .catch(() => undefined);
  }, [token, ingest]);

  /**
   * Realtime: the person who liked first gets the match screen the moment the
   * other side likes back. Payload is UUID-only, so we re-fetch to get the
   * profile behind it.
   */
  useEffect(() => {
    if (!token || !profile) return;

    const client = supabaseBrowser();
    if (!client) return;

    const channel = client
      .channel(`matches:${party.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches', filter: `party_id=eq.${party.id}` },
        (payload) => {
          const row = payload.new as { id: string; user1_id: string; user2_id: string };
          const mine = row.user1_id === profile.id || row.user2_id === profile.id;
          if (!mine || seenMatchIds.current.has(row.id)) return;

          api<{ matches: MatchEntry[] }>('/api/matches', token)
            .then(({ matches: list }) => ingest(list.filter((m) => m.match_id === row.id), true))
            .catch(() => undefined);
        },
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [token, profile, party.id, ingest]);

  // Polling fallback for venue wifi that blocks websockets.
  useEffect(() => {
    if (!token) return;
    const id = setInterval(() => {
      api<{ matches: MatchEntry[] }>('/api/matches', token)
        .then(({ matches: list }) => ingest(list, true))
        .catch(() => undefined);
    }, 15_000);
    return () => clearInterval(id);
  }, [token, ingest]);

  if (loading || !token || !profile) {
    return (
      <main className="pm-shell items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </main>
    );
  }

  const current = pending[0];

  return (
    <main className="pm-shell">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-400">
            {party.code}
          </p>
          <h1 className="text-lg font-bold leading-tight">{party.name}</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-emerald-300">
          <Users className="h-3.5 w-3.5" />
          Na żywo
        </span>
      </header>

      <SwipeDeck
        party={party}
        token={token}
        onMatch={(m) => ingest([m], true)}
      />

      <PartyNav partyCode={party.code} matchCount={matches.length} />

      <AnimatePresence>
        {current && (
          <MatchScreen
            key={current.match_id}
            match={current}
            party={party}
            myPhotoUrl={profile.photo_url}
            onClose={() => setPending((prev) => prev.slice(1))}
          />
        )}
      </AnimatePresence>
    </main>
  );
}
