'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { Heart, X, Loader2, PartyPopper, RefreshCw } from 'lucide-react';
import ProfileCard, { SwipeStamp } from '@/components/ProfileCard';
import AdCard, { buildAdSlots, type AdSlot } from '@/components/AdCard';
import ReportSheet from '@/components/ReportSheet';
import { api } from '@/lib/client-session';
import { AD_EVERY } from '@/lib/shared';
import type { DeckProfile, MatchEntry, Party, SwipeDirection } from '@/lib/types';

const SWIPE_DISTANCE = 110; // px past which a release commits the swipe
const SWIPE_VELOCITY = 550; // px/s flick shortcut
const FETCH_MORE_AT = 4; // top up the queue when this few cards remain

type DeckItem =
  | { key: string; type: 'profile'; profile: DeckProfile }
  | { key: string; type: 'ad'; slot: AdSlot };

interface Props {
  party: Party;
  token: string;
  onMatch: (match: MatchEntry) => void;
}

/**
 * Injects one ad card after every `AD_EVERY` profiles. The ad rotation cycles
 * through whatever slots the party has, so a long session never shows the same
 * sponsor twice in a row when more than one is configured.
 */
function buildQueue(profiles: DeckProfile[], adSlots: AdSlot[]): DeckItem[] {
  const items: DeckItem[] = [];
  let adIndex = 0;

  profiles.forEach((profile, i) => {
    items.push({ key: `p:${profile.id}`, type: 'profile', profile });

    const boundary = (i + 1) % AD_EVERY === 0;
    const isLast = i === profiles.length - 1;
    // Never end the queue on an ad — that would read as "you ran out of people".
    if (boundary && !isLast && adSlots.length > 0) {
      items.push({
        key: `ad:${i}:${adIndex}`,
        type: 'ad',
        slot: adSlots[adIndex % adSlots.length],
      });
      adIndex++;
    }
  });

  return items;
}

export default function SwipeDeck({ party, token, onMatch }: Props) {
  const [profiles, setProfiles] = useState<DeckProfile[]>([]);
  const [cursor, setCursor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<DeckProfile | null>(null);

  const seen = useRef(new Set<string>());
  const fetching = useRef(false);

  const adSlots = useMemo(() => buildAdSlots(party), [party]);
  const queue = useMemo(() => buildQueue(profiles, adSlots), [profiles, adSlots]);
  const remaining = queue.length - cursor;

  const loadMore = useCallback(
    async (initial = false) => {
      if (fetching.current) return;
      fetching.current = true;
      if (initial) setLoading(true);

      try {
        const { profiles: fresh } = await api<{ profiles: DeckProfile[] }>(
          '/api/deck?limit=40',
          token,
        );
        const unseen = fresh.filter((p) => !seen.current.has(p.id));
        unseen.forEach((p) => seen.current.add(p.id));
        if (unseen.length > 0) setProfiles((prev) => [...prev, ...unseen]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Nie udało się wczytać profili.');
      } finally {
        fetching.current = false;
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void loadMore(true);
  }, [loadMore]);

  // Top up before the user hits the bottom, and poll for newcomers when empty.
  useEffect(() => {
    if (loading) return;
    if (remaining <= FETCH_MORE_AT) void loadMore();
  }, [remaining, loading, loadMore]);

  useEffect(() => {
    if (remaining > 0) return;
    const id = setInterval(() => void loadMore(), 12_000);
    return () => clearInterval(id);
  }, [remaining, loadMore]);

  const commit = useCallback(
    async (item: DeckItem, direction: SwipeDirection) => {
      setCursor((c) => c + 1);
      if (item.type !== 'profile') return;

      try {
        const { match } = await api<{ match: MatchEntry | null }>('/api/swipe', token, {
          method: 'POST',
          body: JSON.stringify({ targetId: item.profile.id, direction }),
        });
        if (match) onMatch(match);
      } catch {
        /* A dropped swipe is recoverable: the card just reappears next fetch. */
      }
    },
    [token, onMatch],
  );

  const top = queue[cursor];
  const upcoming = queue.slice(cursor + 1, cursor + 3);

  return (
    <>
      <div className="no-touch-scroll relative mx-auto w-full max-w-md flex-1">
        <div className="relative aspect-[3/4] w-full">
          {/* Stacked peek cards behind the active one */}
          {upcoming
            .slice()
            .reverse()
            .map((item, idx) => {
              const depth = upcoming.length - idx;
              return (
                <div
                  key={item.key}
                  className="absolute inset-0 origin-bottom"
                  style={{
                    transform: `scale(${1 - depth * 0.04}) translateY(${depth * -10}px)`,
                    opacity: 1 - depth * 0.25,
                    zIndex: 10 - depth,
                  }}
                >
                  {item.type === 'profile' ? (
                    <ProfileCard profile={item.profile} />
                  ) : (
                    <AdCard slot={item.slot} />
                  )}
                </div>
              );
            })}

          <AnimatePresence mode="popLayout">
            {top && (
              <SwipeCard
                key={top.key}
                item={top}
                onCommit={commit}
                onReport={setReporting}
              />
            )}
          </AnimatePresence>

          {!top && <EmptyState loading={loading} error={error} onRetry={() => void loadMore(true)} />}
        </div>

        {top && (
          <ActionBar
            onPass={() => void commit(top, 'pass')}
            onLike={() => void commit(top, 'like')}
            isAd={top.type === 'ad'}
          />
        )}
      </div>

      {reporting && (
        <ReportSheet
          profile={reporting}
          token={token}
          onClose={() => setReporting(null)}
          onReported={(id) => {
            setReporting(null);
            setProfiles((prev) => prev.filter((p) => p.id !== id));
          }}
        />
      )}
    </>
  );
}

function SwipeCard({
  item,
  onCommit,
  onReport,
}: {
  item: DeckItem;
  onCommit: (item: DeckItem, direction: SwipeDirection) => void;
  onReport: (p: DeckProfile) => void;
}) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-260, 0, 260], [-16, 0, 16]);
  const likeOpacity = useTransform(x, [40, 150], [0, 1]);
  const passOpacity = useTransform(x, [-150, -40], [1, 0]);

  function handleDragEnd(_: unknown, info: PanInfo) {
    const past = Math.abs(info.offset.x) > SWIPE_DISTANCE;
    const flick = Math.abs(info.velocity.x) > SWIPE_VELOCITY;
    if (!past && !flick) return; // spring back — framer handles it via dragSnapToOrigin
    onCommit(item, info.offset.x > 0 ? 'like' : 'pass');
  }

  return (
    <motion.div
      className="absolute inset-0 z-20 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragSnapToOrigin
      dragElastic={0.55}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{
        x: x.get() >= 0 ? 460 : -460,
        opacity: 0,
        rotate: x.get() >= 0 ? 22 : -22,
        transition: { duration: 0.24, ease: 'easeOut' },
      }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
    >
      {item.type === 'profile' ? (
        <ProfileCard profile={item.profile} onReport={onReport} interactive />
      ) : (
        <AdCard slot={item.slot} />
      )}

      <motion.div
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-5 top-6 -rotate-12"
      >
        <SwipeStamp kind="like" />
      </motion.div>
      <motion.div
        style={{ opacity: passOpacity }}
        className="pointer-events-none absolute right-5 top-6 rotate-12"
      >
        <SwipeStamp kind="pass" />
      </motion.div>
    </motion.div>
  );
}

function ActionBar({
  onPass,
  onLike,
  isAd,
}: {
  onPass: () => void;
  onLike: () => void;
  isAd: boolean;
}) {
  return (
    <div className="mt-6 flex items-center justify-center gap-8">
      <button
        type="button"
        onClick={onPass}
        aria-label={isAd ? 'Pomiń reklamę' : 'Przesuń w lewo'}
        className="flex h-16 w-16 items-center justify-center rounded-full border border-rose-400/30 bg-rose-500/10 text-rose-300 transition active:scale-90"
      >
        <X className="h-7 w-7" />
      </button>

      <button
        type="button"
        onClick={onLike}
        disabled={isAd}
        aria-label="Przesuń w prawo"
        className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-500/10 text-emerald-300 shadow-glow-emerald transition active:scale-90 disabled:opacity-30"
      >
        <Heart className="h-7 w-7" />
      </button>
    </div>
  );
}

function EmptyState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[28px] border border-dashed border-white/10 bg-white/[0.02] px-8 text-center">
      {loading ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
          <p className="text-sm text-zinc-400">Szukam ludzi wokół…</p>
        </>
      ) : error ? (
        <>
          <p className="text-sm text-rose-300">{error}</p>
          <button type="button" onClick={onRetry} className="pm-btn-ghost">
            <RefreshCw className="h-4 w-4" />
            Spróbuj ponownie
          </button>
        </>
      ) : (
        <>
          <PartyPopper className="h-9 w-9 text-violet-400" />
          <p className="text-base font-semibold">To wszyscy na teraz</p>
          <p className="text-sm leading-relaxed text-zinc-400">
            Przejrzałeś/aś każdego, kto już dołączył. Nowe osoby pojawią się tu automatycznie,
            gdy zeskanują kod.
          </p>
        </>
      )}
    </div>
  );
}
