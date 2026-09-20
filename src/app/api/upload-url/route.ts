import { supabaseAdmin } from '@/lib/supabase-server';
import { ALLOWED_PHOTO_TYPES, buildPhotoKey, presignSelfieUpload, type PhotoType } from '@/lib/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Issues a 120-second presigned PUT so the browser can push the compressed
 * selfie straight to R2. We never proxy image bytes.
 */
export async function POST(req: Request) {
  let body: { partyCode?: string; contentLength?: number; contentType?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }

  const partyCode = (body.partyCode ?? '').trim().toUpperCase();
  const contentLength = Number(body.contentLength);
  const contentType = (body.contentType ?? 'image/webp') as PhotoType;

  if (!/^[A-Z0-9-]{4,24}$/.test(partyCode)) {
    return Response.json({ error: 'Nieprawidłowy kod imprezy.' }, { status: 400 });
  }
  if (!ALLOWED_PHOTO_TYPES.includes(contentType)) {
    return Response.json({ error: 'Nieobsługiwany format zdjęcia.' }, { status: 400 });
  }

  // A live party is required — no presigned URLs for expired or fake codes.
  const { data: party } = await supabaseAdmin()
    .from('parties')
    .select('id, expires_at')
    .eq('code', partyCode)
    .maybeSingle();

  if (!party || new Date(party.expires_at).getTime() <= Date.now()) {
    return Response.json({ error: 'Impreza nie istnieje lub już się skończyła.' }, { status: 404 });
  }

  try {
    const key = buildPhotoKey(partyCode, contentType);
    const signed = await presignSelfieUpload(key, contentLength, contentType);
    return Response.json(signed);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Nie udało się podpisać wysyłki.';
    return Response.json({ error: message }, { status: 400 });
  }
}
