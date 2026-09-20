'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearSession, readSession } from '@/lib/client-session';
import type { MyProfile } from '@/lib/types';

interface State {
  token: string | null;
  profile: MyProfile | null;
  loading: boolean;
}

/**
 * Guards every in-party screen: resolves the stored session token to a live
 * profile, or bounces back to the join flow.
 */
export function useProfile(partyCode: string) {
  const router = useRouter();
  const [state, setState] = useState<State>({ token: null, profile: null, loading: true });

  const load = useCallback(async () => {
    const token = readSession(partyCode);
    if (!token) {
      router.replace(`/p/${partyCode}`);
      return;
    }
    try {
      const { profile } = await api<{ profile: MyProfile }>('/api/profile', token);
      setState({ token, profile, loading: false });
    } catch {
      clearSession(partyCode);
      router.replace(`/p/${partyCode}`);
    }
  }, [partyCode, router]);

  useEffect(() => {
    void load();
  }, [load]);

  return { ...state, reload: load, setProfile: (p: MyProfile) => setState((s) => ({ ...s, profile: p })) };
}
