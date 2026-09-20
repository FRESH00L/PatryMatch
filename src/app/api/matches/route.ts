import { supabaseAdmin } from '@/lib/supabase-server';
import { resolveSession, unauthorized } from '@/lib/session';
import type { MatchEntry, DeckProfile } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROFILE_COLUMNS =
  'id, first_name, age, bio, hobbies, relationship_status, looking_for, photo_url';

/**
 * All of the caller's matches, newest first, each resolved to the *other*
 * person's profile. Also the fallback path when the Realtime socket is blocked
 * by a venue's captive wifi.
 */
export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return unauthorized();

  const db = supabaseAdmin();
  const me = session.profileId;

  const { data: rows, error } = await db
    .from('matches')
    .select('id, created_at, user1_id, user2_id')
    .or(`user1_id.eq.${me},user2_id.eq.${me}`)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return Response.json({ error: 'Nie udało się wczytać matchy.' }, { status: 500 });
  if (!rows || rows.length === 0) return Response.json({ matches: [] });

  const otherIds = rows.map((r) => (r.user1_id === me ? r.user2_id : r.user1_id));

  const { data: profiles } = await db
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .in('id', otherIds)
    .eq('is_hidden', false);

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p as unknown as DeckProfile]));

  const matches: MatchEntry[] = rows.flatMap((r) => {
    const otherId = r.user1_id === me ? r.user2_id : r.user1_id;
    const profile = byId.get(otherId);
    // Skip people who deleted their profile or got moderated away.
    return profile ? [{ match_id: r.id, matched_at: r.created_at, profile }] : [];
  });

  return Response.json({ matches });
}
