'use client';

import { useEffect, useRef } from 'react';
import { ExternalLink, Megaphone } from 'lucide-react';
import type { Party } from '@/lib/types';

export type AdSlot =
  | { kind: 'sponsor'; title: string; body: string; cta: string; url: string | null }
  | { kind: 'network' };

/**
 * Builds the ad rotation for a party: a venue sponsorship card if the organiser
 * configured one, plus the programmatic network slot. Returns [] when neither
 * is available, and the deck then simply skips ad positions.
 */
export function buildAdSlots(party: Party): AdSlot[] {
  const slots: AdSlot[] = [];

  if (party.sponsor_title && party.sponsor_body) {
    slots.push({
      kind: 'sponsor',
      title: party.sponsor_title,
      body: party.sponsor_body,
      cta: party.sponsor_cta ?? 'Sprawdź',
      url: party.sponsor_url,
    });
  }

  if (process.env.NEXT_PUBLIC_ADSENSE_CLIENT && process.env.NEXT_PUBLIC_ADSENSE_SLOT) {
    slots.push({ kind: 'network' });
  }

  return slots;
}

/**
 * Native in-feed ad card. Always labelled "Sponsorowane" in the same visual
 * language as the label network policies require — the card is deliberately
 * not swipe-shaped-identical to a profile, so no click is accidental.
 */
export default function AdCard({ slot }: { slot: AdSlot }) {
  return (
    <article className="relative flex h-full w-full flex-col overflow-hidden rounded-[28px] border border-amber-400/25 bg-gradient-to-b from-zinc-900 to-zinc-950 shadow-2xl">
      <div className="flex items-center gap-2 border-b border-white/5 bg-amber-400/10 px-4 py-2.5">
        <Megaphone className="h-3.5 w-3.5 text-amber-300" />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-amber-300">
          Sponsorowane · Ad
        </span>
      </div>

      {slot.kind === 'sponsor' ? <SponsorBody slot={slot} /> : <NetworkBody />}

      <p className="border-t border-white/5 px-4 py-2.5 text-center text-[10px] text-zinc-500">
        Reklama pomaga utrzymać PartyMatch bezpłatnym. Przesuń, aby przejść dalej.
      </p>
    </article>
  );
}

function SponsorBody({ slot }: { slot: Extract<AdSlot, { kind: 'sponsor' }> }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-7 text-center">
      <h3 className="text-2xl font-bold leading-tight text-amber-100">{slot.title}</h3>
      <p className="text-sm leading-relaxed text-zinc-300">{slot.body}</p>
      {slot.url ? (
        <a
          href={slot.url}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="pm-btn border border-amber-400/40 bg-amber-400/15 text-amber-100"
        >
          {slot.cta}
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : (
        <span className="rounded-2xl border border-amber-400/40 bg-amber-400/15 px-5 py-3 text-sm font-semibold text-amber-100">
          {slot.cta}
        </span>
      )}
    </div>
  );
}

/** Google AdSense in-feed unit. Renders a placeholder until the script loads. */
function NetworkBody() {
  const ref = useRef<HTMLModElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current || !ref.current) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle ?? []).push({});
    } catch {
      /* ad blocker or script not loaded — the placeholder stays */
    }
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <ins
        ref={ref}
        className="adsbygoogle block h-full w-full"
        style={{ display: 'block' }}
        data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}
        data-ad-slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT}
        data-ad-format="fluid"
        data-ad-layout-key="-6t+ed+2i-1n-4w"
      />
    </div>
  );
}
