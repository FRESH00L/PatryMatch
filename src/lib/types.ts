export type RelationshipStatus = 'single' | 'taken' | 'complicated';
export type LookingFor = 'friends' | 'casual' | 'partner';
export type SwipeDirection = 'like' | 'pass';

export interface Party {
  id: string;
  code: string;
  name: string;
  venue: string | null;
  starts_at: string;
  expires_at: string;
  sponsor_title: string | null;
  sponsor_body: string | null;
  sponsor_cta: string | null;
  sponsor_url: string | null;
}

/** A candidate as shown in the deck — no session tokens, no R2 keys. */
export interface DeckProfile {
  id: string;
  first_name: string;
  age: number;
  bio: string | null;
  hobbies: string[];
  relationship_status: RelationshipStatus;
  looking_for: LookingFor;
  photo_url: string;
}

/** The signed-in user's own profile. */
export interface MyProfile extends DeckProfile {
  party_id: string;
  is_active: boolean;
  created_at: string;
}

export interface MatchEntry {
  match_id: string;
  matched_at: string;
  profile: DeckProfile;
}

export const RELATIONSHIP_LABELS: Record<RelationshipStatus, string> = {
  single: 'Singiel',
  taken: 'Zajęty/a',
  complicated: 'To skomplikowane',
};

export const LOOKING_FOR_LABELS: Record<LookingFor, string> = {
  friends: 'Nowi znajomi',
  casual: 'Coś na luzie',
  partner: 'Szukam partnera/ki',
};

export const HOBBY_OPTIONS = [
  'Taniec', 'Techno', 'Rock', 'Hip-hop', 'Karaoke', 'Koncerty',
  'Siłownia', 'Bieganie', 'Wspinaczka', 'Rower', 'Narty', 'Piłka',
  'Podróże', 'Gotowanie', 'Kino', 'Seriale', 'Gry', 'Anime',
  'Książki', 'Sztuka', 'Fotografia', 'Kawa', 'Craft beer', 'Koty', 'Psy',
] as const;
