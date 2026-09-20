import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Public party lookup — what the QR landing page needs to render. */
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const code = params.code.trim().toUpperCase();

  const { data, error } = await supabaseAdmin()
    .from('parties')
    .select('id, code, name, venue, starts_at, expires_at, sponsor_title, sponsor_body, sponsor_cta, sponsor_url')
    .eq('code', code)
    .maybeSingle();

  if (error) return Response.json({ error: 'Błąd bazy danych.' }, { status: 500 });
  if (!data) return Response.json({ error: 'Nie znaleziono takiej imprezy.' }, { status: 404 });

  if (new Date(data.expires_at).getTime() <= Date.now()) {
    return Response.json({ error: 'Ta impreza już się skończyła.', expired: true }, { status: 410 });
  }

  const { count } = await supabaseAdmin()
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('party_id', data.id)
    .eq('is_active', true)
    .eq('is_hidden', false);

  return Response.json({ party: data, activeCount: count ?? 0 });
}
