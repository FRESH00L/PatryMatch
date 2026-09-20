'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import JoinFlow from '@/components/JoinFlow';
import { api, clearSession, readSession } from '@/lib/client-session';
import type { MyProfile, Party } from '@/lib/types';

/**
 * Returning guests keep their session in localStorage, so a re-scan of the same
 * QR should drop them back into the deck instead of asking for a second selfie.
 */
export default function PartyEntry({ party, activeCount }: { party: Party; activeCount: number }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = readSession(party.code);
    if (!token) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    api<{ profile: MyProfile }>('/api/profile', token)
      .then(() => {
        if (!cancelled) router.replace(`/p/${party.code}/deck`);
      })
      .catch(() => {
        // Expired or revoked session — start over.
        clearSession(party.code);
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [party.code, router]);

  if (checking) {
    return (
      <main className="pm-shell items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </main>
    );
  }

  return (
    <main>
      <JoinFlow party={party} activeCount={activeCount} />
    </main>
  );
}
