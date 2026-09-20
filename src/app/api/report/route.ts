import { supabaseAdmin } from '@/lib/supabase-server';
import { resolveSession, unauthorized } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * DSA art. 16 notice-and-action. The report is stored, `trg_apply_report`
 * bumps the counter and hides the profile at the threshold, and the reporter
 * additionally auto-passes so they never see that card again.
 */
export async function POST(req: Request) {
  const session = await resolveSession(req);
  if (!session) return unauthorized();

  let body: { targetId?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }

  const targetId = String(body.targetId ?? '');
  if (!UUID_RE.test(targetId) || targetId === session.profileId) {
    return Response.json({ error: 'Nieprawidłowy profil.' }, { status: 400 });
  }

  const reason = (body.reason ?? '').trim().slice(0, 500) || null;
  const db = supabaseAdmin();

  const { error } = await db.from('reports').insert({
    reported_profile_id: targetId,
    reporter_profile_id: session.profileId,
    reason,
  });

  // 23505 = already reported by this user; keep it idempotent.
  if (error && error.code !== '23505') {
    return Response.json({ error: 'Nie udało się wysłać zgłoszenia.' }, { status: 400 });
  }

  await db
    .from('swipes')
    .insert({
      party_id: session.partyId,
      swiper_id: session.profileId,
      target_id: targetId,
      direction: 'pass',
    })
    .then(() => undefined, () => undefined);

  return Response.json({ reported: true });
}
