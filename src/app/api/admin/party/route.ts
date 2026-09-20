import { supabaseAdmin } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Ambiguous glyphs (0/O, 1/I) are excluded — codes get read off a printed QR.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 6): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

function authorized(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
  return Boolean(secret) && req.headers.get('x-admin-secret') === secret;
}

/** Organiser endpoint: mints a party + its QR code. */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Forbidden' }, { status: 403 });

  let body: {
    name?: string;
    venue?: string;
    ttlHours?: number;
    sponsorTitle?: string;
    sponsorBody?: string;
    sponsorCta?: string;
    sponsorUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }

  const name = (body.name ?? '').trim();
  if (name.length < 2 || name.length > 80) {
    return Response.json({ error: 'Nazwa imprezy: 2-80 znaków.' }, { status: 400 });
  }

  // GDPR: the TTL is the retention period, so it is capped in code, not config.
  const ttlHours = Math.min(Math.max(Number(body.ttlHours ?? 36), 1), 48);
  const now = new Date();
  const expires = new Date(now.getTime() + ttlHours * 3600_000);

  const db = supabaseAdmin();

  // Retry on the (astronomically unlikely) code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { data, error } = await db
      .from('parties')
      .insert({
        code,
        name,
        venue: (body.venue ?? '').trim() || null,
        starts_at: now.toISOString(),
        expires_at: expires.toISOString(),
        sponsor_title: (body.sponsorTitle ?? '').trim() || null,
        sponsor_body: (body.sponsorBody ?? '').trim() || null,
        sponsor_cta: (body.sponsorCta ?? '').trim() || null,
        sponsor_url: (body.sponsorUrl ?? '').trim() || null,
      })
      .select('id, code, name, venue, starts_at, expires_at')
      .single();

    if (!error && data) {
      const origin = new URL(req.url).origin;
      return Response.json({ party: data, joinUrl: `${origin}/p/${data.code}` }, { status: 201 });
    }
    if (error && error.code !== '23505') {
      return Response.json({ error: 'Nie udało się utworzyć imprezy.' }, { status: 500 });
    }
  }

  return Response.json({ error: 'Nie udało się wygenerować kodu.' }, { status: 500 });
}
