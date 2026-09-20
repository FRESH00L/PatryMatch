'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Loader2, LogOut, Trash2, X } from 'lucide-react';
import PartyNav from '@/components/PartyNav';
import CameraCapture from '@/components/CameraCapture';
import { SingleChoice, MultiChoice } from '@/components/ChipGroup';
import { useProfile } from '@/components/useProfile';
import { api, clearSession } from '@/lib/client-session';
import { uploadSelfie, type CapturedPhoto } from '@/lib/image';
import {
  HOBBY_OPTIONS,
  LOOKING_FOR_LABELS,
  RELATIONSHIP_LABELS,
  type LookingFor,
  type MyProfile,
  type Party,
  type RelationshipStatus,
} from '@/lib/types';

const RELATIONSHIP_OPTIONS: RelationshipStatus[] = ['single', 'taken', 'complicated'];
const LOOKING_OPTIONS: LookingFor[] = ['friends', 'casual', 'partner'];
const MAX_HOBBIES = 5;

export default function ProfileScreen({ party }: { party: Party }) {
  const router = useRouter();
  const { token, profile, loading, setProfile } = useProfile(party.code);

  const [firstName, setFirstName] = useState('');
  const [bio, setBio] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>('single');
  const [lookingFor, setLookingFor] = useState<LookingFor>('friends');

  const [retaking, setRetaking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate the form once the profile arrives.
  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name);
    setBio(profile.bio ?? '');
    setHobbies(profile.hobbies);
    setRelationshipStatus(profile.relationship_status);
    setLookingFor(profile.looking_for);
  }, [profile]);

  async function save(patch: Record<string, unknown>) {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const { profile: updated } = await api<{ profile: MyProfile }>('/api/profile', token, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać.');
    } finally {
      setSaving(false);
    }
  }

  async function replacePhoto(photo: CapturedPhoto) {
    if (!token) return;
    setRetaking(false);
    setSaving(true);
    setError(null);
    try {
      const { photoKey } = await uploadSelfie(photo, party.code, token);
      await save({ photoKey });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić zdjęcia.');
      setSaving(false);
    }
  }

  async function deleteProfile() {
    if (!token) return;
    setSaving(true);
    try {
      await api('/api/profile', token, { method: 'DELETE' });
      clearSession(party.code);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się usunąć profilu.');
      setSaving(false);
    }
  }

  if (loading || !profile || !token) {
    return (
      <main className="pm-shell items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </main>
    );
  }

  if (retaking) {
    return (
      <main className="pm-shell">
        <button
          type="button"
          onClick={() => setRetaking(false)}
          className="mb-4 self-start text-sm text-zinc-400"
        >
          <X className="mr-1 inline h-4 w-4" />
          Anuluj
        </button>
        <CameraCapture
          onAccept={replacePhoto}
          title="Nowe zdjęcie"
          subtitle="Stare zdjęcie zostanie natychmiast trwale usunięte."
          ctaLabel="Zapisz to zdjęcie"
        />
      </main>
    );
  }

  const dirty =
    firstName.trim() !== profile.first_name ||
    bio.trim() !== (profile.bio ?? '') ||
    relationshipStatus !== profile.relationship_status ||
    lookingFor !== profile.looking_for ||
    hobbies.join('|') !== profile.hobbies.join('|');

  return (
    <main className="pm-shell">
      <header className="mb-5">
        <h1 className="text-2xl font-bold">Twój profil</h1>
        <p className="mt-1 text-sm text-zinc-400">Widoczny tylko na tej imprezie.</p>
      </header>

      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={profile.photo_url}
          alt=""
          className="h-28 w-[84px] rounded-2xl border border-white/10 object-cover"
        />
        <button type="button" onClick={() => setRetaking(true)} className="pm-btn-ghost">
          <Camera className="h-4 w-4" />
          Zmień zdjęcie
        </button>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="pm-label" htmlFor="name">Imię</label>
          <input
            id="name"
            className="pm-input"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value.slice(0, 30))}
          />
        </div>

        <SingleChoice
          label="Status"
          options={RELATIONSHIP_OPTIONS}
          labels={RELATIONSHIP_LABELS}
          value={relationshipStatus}
          onChange={setRelationshipStatus}
        />

        <SingleChoice
          label="Szukam"
          options={LOOKING_OPTIONS}
          labels={LOOKING_FOR_LABELS}
          value={lookingFor}
          onChange={setLookingFor}
        />

        <div>
          <label className="pm-label" htmlFor="bio2">
            Bio
            <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">
              {bio.length}/120
            </span>
          </label>
          <textarea
            id="bio2"
            className="pm-input min-h-[84px] resize-none"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, 120))}
          />
        </div>

        <MultiChoice
          label="Hobby"
          options={HOBBY_OPTIONS}
          value={hobbies}
          max={MAX_HOBBIES}
          onChange={setHobbies}
        />
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!dirty || saving}
        onClick={() =>
          save({
            firstName: firstName.trim(),
            bio: bio.trim(),
            hobbies,
            relationshipStatus,
            lookingFor,
          })
        }
        className="pm-btn-primary mt-6 w-full py-4"
      >
        {saving ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : saved ? (
          <Check className="h-5 w-5" />
        ) : null}
        {saved ? 'Zapisano' : 'Zapisz zmiany'}
      </button>

      {/* GDPR art. 17 — one tap, photo and rows gone. */}
      <section className="mt-8 rounded-3xl border border-rose-500/20 bg-rose-500/[0.06] p-5">
        <h2 className="text-sm font-bold text-rose-200">Usuń profil i zdjęcie</h2>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-400">
          Twoje zdjęcie zostanie natychmiast skasowane z magazynu, a profil, swipe’y i matche
          usunięte z bazy. Operacja jest nieodwracalna.
        </p>

        {confirmDelete ? (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => setConfirmDelete(false)} className="pm-btn-ghost">
              Anuluj
            </button>
            <button
              type="button"
              onClick={deleteProfile}
              disabled={saving}
              className="pm-btn bg-rose-600 text-white hover:bg-rose-500"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Usuń na zawsze
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="pm-btn-ghost mt-4 w-full border-rose-500/30 text-rose-200"
          >
            <Trash2 className="h-4 w-4" />
            Usuń mój profil i zdjęcie
          </button>
        )}
      </section>

      <button
        type="button"
        onClick={() => {
          clearSession(party.code);
          router.replace('/');
        }}
        className="mt-4 inline-flex items-center justify-center gap-2 text-xs text-zinc-500"
      >
        <LogOut className="h-3.5 w-3.5" />
        Wyloguj na tym urządzeniu (profil zostaje)
      </button>

      <PartyNav partyCode={party.code} />
    </main>
  );
}
