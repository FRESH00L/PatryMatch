import { supabaseAdmin } from '@/lib/supabase-server';
import { SESSION_HEADER, resolveSession, unauthorized } from '@/lib/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Candidates still un-swiped by the caller, within the caller's party only.
 * The party scoping lives in fn_get_deck (SECURITY DEFINER), so it cannot be
 * widened from the client.
 */
export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return unauthorized();

  const token = req.headers.get(SESSION_HEADER)!;
  const requested = Number(new URL(req.url).searchParams.get('limit'));
  const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 60) : 40;

  const { data, error } = await supabaseAdmin().rpc('fn_get_deck', {
    p_session_token: token,
    p_limit: limit,
  });

  if (error) return Response.json({ error: 'Nie udało się wczytać talii.' }, { status: 500 });

  return Response.json({ profiles: data ?? [] });
}
