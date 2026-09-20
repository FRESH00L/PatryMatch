'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Anon client, used for exactly one thing: the Realtime subscription on
 * `matches` that pops the match screen the instant the other side likes back.
 * RLS keeps this feed to UUIDs of live parties only.
 */
let cached: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null; // Realtime is a progressive enhancement.

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 5 } },
  });
  return cached;
}
