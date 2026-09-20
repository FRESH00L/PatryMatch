import { supabaseAdmin } from '@/lib/supabase-server';
import type { Party } from '@/lib/types';

export interface PartyLookup {
  party: Party | null;
  activeCount: number;
  expired: boolean;
}

/** Server-component helper — reads the party straight from the DB, no HTTP hop. */
export async function getParty(rawCode: string): Promise<PartyLookup> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,24}$/.test(code)) {
    return { party: null, activeCount: 0, expired: false };
  }

  const db = supabaseAdmin();
  const { data } = await db
    .from('parties')
    .select(
      'id, code, name, venue, starts_at, expires_at, sponsor_title, sponsor_body, sponsor_cta, sponsor_url',
    )
    .eq('code', code)
    .maybeSingle();

  if (!data) return { party: null, activeCount: 0, expired: false };

  const expired = new Date(data.expires_at).getTime() <= Date.now();
  if (expired) return { party: data as Party, activeCount: 0, expired: true };

  const { count } = await db
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('party_id', data.id)
    .eq('is_active', true)
    .eq('is_hidden', false);

  return { party: data as Party, activeCount: count ?? 0, expired: false };
}
