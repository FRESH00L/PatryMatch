import { supabaseAdmin } from '@/lib/supabase-server';
import { resolveSession, unauthorized } from '@/lib/session';
import type { SwipeDirection } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records one swipe. The match is created by the `trg_detect_match` trigger,
 * so the swiper who closes the loop learns about it in the same round-trip.
 */
export async function POST(req: Request) {
  const session = await resolveSession(req);
  if (!session) return unauthorized();

  let body: { targetId?: string; direction?: SwipeDirection };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }

  const targetId = String(body.targetId ?? '');
  const direction = body.direction;

  if (!UUID_RE.test(targetId)) {
    return Response.json({ error: 'Nieprawidłowy profil.' }, { status: 400 });
  }
  if (direction !== 'like' && direction !== 'pass') {
    return Response.json({ error: 'Nieprawidłowy kierunek swipe.' }, { status: 400 });
  }
  if (targetId === session.profileId) {
    return Response.json({ error: 'Nie możesz swipować własnego profilu.' }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { error } = await db.from('swipes').insert({
    party_id: session.partyId,
    swiper_id: session.profileId,
    target_id: targetId,
    direction,
  });

  // 23505 = duplicate swipe. Idempotent: treat as already handled.
  if (error && error.code !== '23505') {
    return Response.json({ error: 'Nie udało się zapisać swipe.' }, { status: 400 });
  }

  if (direction === 'pass') return Response.json({ match: null });

  const [a, b] = [session.profileId, targetId].sort();
  const { data: match } = await db
    .from('matches')
    .select('id, created_at')
    .eq('user1_id', a)
    .eq('user2_id', b)
    .maybeSingle();

  if (!match) return Response.json({ match: null });

  const { data: other } = await db
    .from('profiles')
    .select('id, first_name, age, bio, hobbies, relationship_status, looking_for, photo_url')
    .eq('id', targetId)
    .single();

  return Response.json({
    match: { match_id: match.id, matched_at: match.created_at, profile: other },
  });
}
