'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ShieldCheck, Loader2, ArrowRight, Sparkles, MapPin, Users } from 'lucide-react';
import CameraCapture from '@/components/CameraCapture';
import { SingleChoice, MultiChoice } from '@/components/ChipGroup';
import { uploadSelfie, type CapturedPhoto } from '@/lib/image';
import { api, writeSession } from '@/lib/client-session';
import {
  HOBBY_OPTIONS,
  LOOKING_FOR_LABELS,
  RELATIONSHIP_LABELS,
  type LookingFor,
  type Party,
  type RelationshipStatus,
} from '@/lib/types';

const RELATIONSHIP_OPTIONS: RelationshipStatus[] = ['single', 'taken', 'complicated'];
const LOOKING_OPTIONS: LookingFor[] = ['friends', 'casual', 'partner'];
const MAX_HOBBIES = 5;

type Step = 'consent' | 'photo' | 'details';

export default function JoinFlow({ party, activeCount }: { party: Party; activeCount: number }) {
  const router = useRouter();

  const [step, setStep] = useState<Step>('consent');
  const [adult, setAdult] = useState(false);
  const [consentPhoto, setConsentPhoto] = useState(false);

  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [firstName, setFirstName] = useState('');
  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [relationshipStatus, setRelationshipStatus] = useState<RelationshipStatus>('single');
  const [lookingFor, setLookingFor] = useState<LookingFor>('friends');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    firstName.trim().length >= 2 &&
    Number(age) >= 18 &&
    Number(age) <= 99 &&
    photo !== null &&
    !submitting;

  async function submit() {
    if (!photo || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      // Photo goes straight to R2 first; only its key reaches our database.
      const { photoKey } = await uploadSelfie(photo, party.code);

      const { sessionToken } = await api<{ sessionToken: string }>('/api/profile', null, {
        method: 'POST',
        body: JSON.stringify({
          partyCode: party.code,
          photoKey,
          firstName: firstName.trim(),
          age: Number(age),
          bio: bio.trim(),
          hobbies,
          relationshipStatus,
          lookingFor,
          consentPhoto: true,
        }),
      });

      writeSession(party.code, sessionToken);
      router.replace(`/p/${party.code}/deck`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Coś poszło nie tak.');
      setSubmitting(false);
    }
  }

  return (
    <div className="pm-shell">
      <PartyHeader party={party} activeCount={activeCount} />

      {step === 'consent' && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-1 flex-col"
        >
          <div className="pm-card p-5">
            <div className="mb-4 flex items-center gap-2 text-violet-300">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-sm font-semibold uppercase tracking-wider">Zanim wejdziesz</h2>
            </div>

            <ConsentBox
              checked={adult}
              onChange={setAdult}
              title="Mam ukończone 18 lat"
              body="PartyMatch jest wyłącznie dla osób pełnoletnich. Fałszywe oświadczenie skutkuje usunięciem profilu."
            />

            <ConsentBox
              checked={consentPhoto}
              onChange={setConsentPhoto}
              title="Zgoda na przetwarzanie wizerunku"
              body="Wyrażam wyraźną zgodę (art. 9 ust. 2 lit. a RODO) na to, by moje selfie oraz podane dane były widoczne dla innych uczestników tej imprezy. Zgodę mogę wycofać w każdej chwili, usuwając profil jednym kliknięciem."
            />

            <ul className="mt-4 space-y-1.5 text-[11px] leading-relaxed text-zinc-500">
              <li>· Nie zakładasz konta i nie podajesz e-maila ani numeru telefonu.</li>
              <li>· Zdjęcie i profil są kasowane automatycznie po zakończeniu imprezy.</li>
              <li>· Nie ma czatu — po matchu znajdujecie się na miejscu.</li>
            </ul>
          </div>

          <div className="mt-auto pt-6">
            <button
              type="button"
              disabled={!adult || !consentPhoto}
              onClick={() => setStep('photo')}
              className="pm-btn-primary w-full py-4 text-base"
            >
              Wchodzę
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </motion.section>
      )}

      {step === 'photo' && (
        <section className="mt-6">
          <CameraCapture
            onAccept={(p) => {
              // Release the previous attempt's preview before replacing it.
              if (photo) URL.revokeObjectURL(photo.previewUrl);
              setPhoto(p);
              setStep('details');
            }}
          />
        </section>
      )}

      {step === 'details' && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 flex flex-1 flex-col gap-5"
        >
          <div className="flex items-center gap-4">
            {photo && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo.previewUrl}
                alt=""
                className="h-20 w-16 rounded-2xl border border-white/10 object-cover"
              />
            )}
            <div>
              <h2 className="text-lg font-bold">Twój profil na dziś</h2>
              <button
                type="button"
                onClick={() => setStep('photo')}
                className="mt-1 text-xs font-medium text-violet-300 underline underline-offset-4"
              >
                Zmień zdjęcie
              </button>
            </div>
          </div>

          <div className="grid grid-cols-[1fr,88px] gap-3">
            <div>
              <label className="pm-label" htmlFor="firstName">Imię</label>
              <input
                id="firstName"
                className="pm-input"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value.slice(0, 30))}
                placeholder="Ala"
                autoComplete="given-name"
                enterKeyHint="next"
              />
            </div>
            <div>
              <label className="pm-label" htmlFor="age">Wiek</label>
              <input
                id="age"
                className="pm-input text-center"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="24"
              />
            </div>
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
            <label className="pm-label" htmlFor="bio">
              Bio
              <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">
                {bio.length}/120
              </span>
            </label>
            <textarea
              id="bio"
              className="pm-input min-h-[84px] resize-none"
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 120))}
              placeholder="Przy barze, w czarnej kurtce. Stawiam shota za dobry żart."
            />
          </div>

          <MultiChoice
            label="Hobby"
            hint="wybierz kilka"
            options={HOBBY_OPTIONS}
            value={hobbies}
            max={MAX_HOBBIES}
            onChange={setHobbies}
          />

          {error && (
            <p className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          )}

          <div className="mt-auto pt-2">
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="pm-btn-primary w-full py-4 text-base"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              {submitting ? 'Wchodzę na imprezę…' : 'Zaczynamy'}
            </button>
          </div>
        </motion.section>
      )}
    </div>
  );
}

function PartyHeader({ party, activeCount }: { party: Party; activeCount: number }) {
  return (
    <header className="animate-fade-up">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-400">
        PartyMatch · {party.code}
      </p>
      <h1 className="mt-1 text-2xl font-bold leading-tight">{party.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
        {party.venue && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {party.venue}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-emerald-400">
          <Users className="h-3.5 w-3.5" />
          {activeCount} {activeCount === 1 ? 'osoba' : 'osób'} tu teraz
        </span>
      </div>
    </header>
  );
}

function ConsentBox({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <label className="mt-3 flex cursor-pointer gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition active:scale-[0.99]">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-violet-500"
      />
      <span>
        <span className="block text-sm font-semibold text-zinc-100">{title}</span>
        <span className="mt-1 block text-[11px] leading-relaxed text-zinc-400">{body}</span>
      </span>
    </label>
  );
}
