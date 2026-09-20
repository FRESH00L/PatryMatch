import { supabaseAdmin } from '@/lib/supabase-server';
import { deleteObjects, publicUrlFor } from '@/lib/r2';
import { newSessionToken, resolveSession, unauthorized } from '@/lib/session';
import type { LookingFor, RelationshipStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RELATIONSHIP: RelationshipStatus[] = ['single', 'taken', 'complicated'];
const LOOKING: LookingFor[] = ['friends', 'casual', 'partner'];
const PROFILE_COLUMNS =
  'id, party_id, first_name, age, bio, hobbies, relationship_status, looking_for, photo_url, is_active, created_at';

const PHOTO_KEY_RE = /^parties\/[a-z0-9-]{1,24}\/[a-f0-9]{32}\.(webp|jpg)$/;

interface ProfilePayload {
  firstName?: string;
  age?: number;
  bio?: string | null;
  hobbies?: string[];
  relationshipStatus?: string;
  lookingFor?: string;
}

interface Validated {
  first_name: string;
  age: number;
  bio: string | null;
  hobbies: string[];
  relationship_status: RelationshipStatus;
  looking_for: LookingFor;
}

function validate(body: ProfilePayload, partial: false): Validated | string;
function validate(body: ProfilePayload, partial: true): Partial<Validated> | string;
function validate(body: ProfilePayload, partial: boolean): Partial<Validated> | string {
  const out: Partial<Validated> = {};

  if (body.firstName !== undefined || !partial) {
    const name = (body.firstName ?? '').trim();
    if (name.length < 2 || name.length > 30) return 'Imię musi mieć od 2 do 30 znaków.';
    out.first_name = name;
  }

  if (body.age !== undefined || !partial) {
    const age = Number(body.age);
    if (!Number.isInteger(age) || age < 18 || age > 99) {
      return 'Aplikacja jest dostępna wyłącznie dla osób pełnoletnich (18+).';
    }
    out.age = age;
  }

  if (body.bio !== undefined || !partial) {
    const bio = (body.bio ?? '').trim();
    if (bio.length > 120) return 'Bio może mieć maksymalnie 120 znaków.';
    out.bio = bio || null;
  }

  if (body.hobbies !== undefined || !partial) {
    const raw = Array.isArray(body.hobbies) ? body.hobbies : [];
    const hobbies = Array.from(
      new Set(raw.map((h) => String(h).trim()).filter((h) => h.length > 0 && h.length <= 24)),
    ).slice(0, 6);
    out.hobbies = hobbies;
  }

  if (body.relationshipStatus !== undefined || !partial) {
    const rs = body.relationshipStatus as RelationshipStatus;
    if (!RELATIONSHIP.includes(rs)) return 'Wybierz status związku.';
    out.relationship_status = rs;
  }

  if (body.lookingFor !== undefined || !partial) {
    const lf = body.lookingFor as LookingFor;
    if (!LOOKING.includes(lf)) return 'Wybierz, czego szukasz.';
    out.looking_for = lf;
  }

  return out;
}

/** GET — my own profile. */
export async function GET(req: Request) {
  const session = await resolveSession(req);
  if (!session) return unauthorized();

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', session.profileId)
    .single();

  if (error) return Response.json({ error: 'Nie udało się wczytać profilu.' }, { status: 500 });
  return Response.json({ profile: data });
}

/** POST — create a profile and mint a session token. */
export async function POST(req: Request) {
  let body: ProfilePayload & { partyCode?: string; photoKey?: string; consentPhoto?: boolean };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }

  if (body.consentPhoto !== true) {
    return Response.json(
      { error: 'Wymagana jest zgoda na przetwarzanie wizerunku (RODO).' },
      { status: 400 },
    );
  }

  const partyCode = (body.partyCode ?? '').trim().toUpperCase();
  const photoKey = (body.photoKey ?? '').trim();
  if (!PHOTO_KEY_RE.test(photoKey)) {
    return Response.json({ error: 'Brak poprawnego zdjęcia.' }, { status: 400 });
  }

  const fields = validate(body, false);
  if (typeof fields === 'string') return Response.json({ error: fields }, { status: 400 });

  const db = supabaseAdmin();

  const { data: party } = await db
    .from('parties')
    .select('id, expires_at')
    .eq('code', partyCode)
    .maybeSingle();

  if (!party || new Date(party.expires_at).getTime() <= Date.now()) {
    return Response.json({ error: 'Impreza nie istnieje lub już się skończyła.' }, { status: 404 });
  }

  // The photo key was minted under this party's prefix; the URL is derived
  // server-side so a client can never point photo_url somewhere else.
  if (!photoKey.startsWith(`parties/${partyCode.toLowerCase()}/`)) {
    return Response.json({ error: 'Zdjęcie nie pasuje do tej imprezy.' }, { status: 400 });
  }

  const sessionToken = newSessionToken();

  const { data, error } = await db
    .from('profiles')
    .insert({
      ...fields,
      party_id: party.id,
      photo_key: photoKey,
      photo_url: publicUrlFor(photoKey),
      session_token: sessionToken,
      consent_photo: true,
      consent_at: new Date().toISOString(),
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) {
    return Response.json({ error: 'Nie udało się utworzyć profilu.' }, { status: 500 });
  }

  return Response.json({ profile: data, sessionToken }, { status: 201 });
}

/** PATCH — edit name / bio / hobbies / preferences, optionally swap the photo. */
export async function PATCH(req: Request) {
  const session = await resolveSession(req);
  if (!session) return unauthorized();

  let body: ProfilePayload & { photoKey?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Nieprawidłowe żądanie.' }, { status: 400 });
  }

  const fields = validate(body, true);
  if (typeof fields === 'string') return Response.json({ error: fields }, { status: 400 });

  const patch: Record<string, unknown> = { ...fields };
  let staleKey: string | null = null;

  if (body.photoKey) {
    const photoKey = body.photoKey.trim();
    if (!PHOTO_KEY_RE.test(photoKey) ||
        !photoKey.startsWith(`parties/${session.partyCode.toLowerCase()}/`)) {
      return Response.json({ error: 'Nieprawidłowe zdjęcie.' }, { status: 400 });
    }
    if (photoKey !== session.photoKey) {
      patch.photo_key = photoKey;
      patch.photo_url = publicUrlFor(photoKey);
      staleKey = session.photoKey;
    }
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: 'Brak zmian.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .update(patch)
    .eq('id', session.profileId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error) return Response.json({ error: 'Nie udało się zapisać zmian.' }, { status: 500 });

  // Replaced photo is purged immediately — no orphans in the bucket.
  if (staleKey) await deleteObjects([staleKey]).catch(() => undefined);

  return Response.json({ profile: data });
}

/** DELETE — "prawo do bycia zapomnianym": R2 object first, then every row. */
export async function DELETE(req: Request) {
  const session = await resolveSession(req);
  if (!session) return unauthorized();

  await deleteObjects([session.photoKey]).catch(() => undefined);

  const { error } = await supabaseAdmin()
    .from('profiles')
    .delete()
    .eq('id', session.profileId);

  if (error) return Response.json({ error: 'Nie udało się usunąć profilu.' }, { status: 500 });

  // swipes / matches / reports cascade on the FK.
  return Response.json({ deleted: true });
}
