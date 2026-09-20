import { supabaseAdmin } from '@/lib/supabase-server';
import { deleteObjects } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Ephemeral-data worker. Runs every 15 min (Vercel Cron or pg_cron + pg_net).
 *
 *   1. Collect photo keys of every profile belonging to an expired party.
 *   2. Hard-delete those objects from R2 (zero egress, so this is free).
 *   3. Delete the party rows — profiles/swipes/matches/reports cascade.
 *   4. Drain deletion_queue: keys left by individual profile deletions.
 */
async function runCleanup() {
  const db = supabaseAdmin();
  const nowIso = new Date().toISOString();

  const { data: expired, error: partyErr } = await db
    .from('parties')
    .select('id')
    .lt('expires_at', nowIso)
    .limit(200);

  if (partyErr) throw new Error(partyErr.message);

  const partyIds = (expired ?? []).map((p) => p.id as string);
  let photosDeleted = 0;
  let profilesDeleted = 0;

  if (partyIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('photo_key')
      .in('party_id', partyIds);

    const keys = (profiles ?? []).map((p) => p.photo_key as string).filter(Boolean);
    profilesDeleted = keys.length;

    // Storage first: if the DB delete fails we would otherwise lose the keys.
    photosDeleted += await deleteObjects(keys);

    const { error: delErr } = await db.from('parties').delete().in('id', partyIds);
    if (delErr) throw new Error(delErr.message);
  }

  // Drain whatever the BEFORE DELETE trigger parked for us.
  const { data: queued } = await db
    .from('deletion_queue')
    .select('id, photo_key')
    .limit(1000);

  if (queued && queued.length > 0) {
    photosDeleted += await deleteObjects(queued.map((q) => q.photo_key as string));
    await db.from('deletion_queue').delete().in('id', queued.map((q) => q.id));
  }

  return {
    partiesPurged: partyIds.length,
    profilesPurged: profilesDeleted,
    photosDeleted,
    queueDrained: queued?.length ?? 0,
  };
}

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get('x-cron-secret');
  const bearer = req.headers.get('authorization');
  return header === secret || bearer === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  try {
    return Response.json({ ok: true, ...(await runCleanup()) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cleanup failed';
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}

export const POST = GET;
