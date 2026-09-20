import { supabaseAdmin } from '@/lib/supabase-server';
import { SESSION_HEADER } from '@/lib/shared';

export { SESSION_HEADER };

export function newSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface Session {
  profileId: string;
  partyId: string;
  partyCode: string;
  photoKey: string;
}

/**
 * Resolves the caller's session token to a live profile in a live party.
 * Returns null for unknown, hidden, deactivated or expired sessions.
 */
export async function resolveSession(req: Request): Promise<Session | null> {
  const token = req.headers.get(SESSION_HEADER);
  if (!token || token.length < 32) return null;

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .select('id, party_id, photo_key, is_active, is_hidden, parties!inner(code, expires_at)')
    .eq('session_token', token)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.is_active || data.is_hidden) return null;

  const party = data.parties as unknown as { code: string; expires_at: string };
  if (new Date(party.expires_at).getTime() <= Date.now()) return null;

  return {
    profileId: data.id as string,
    partyId: data.party_id as string,
    partyCode: party.code,
    photoKey: data.photo_key as string,
  };
}

export function unauthorized() {
  return Response.json({ error: 'Nieprawidłowa lub wygasła sesja.' }, { status: 401 });
}
