'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Download, Loader2, QrCode, Printer } from 'lucide-react';

interface Created {
  code: string;
  name: string;
  venue: string | null;
  expiresAt: string;
  joinUrl: string;
  qrDataUrl: string;
}

/**
 * Organiser console. The admin secret is typed in, never bundled — it goes out
 * as a header on a single request and is not persisted.
 */
export default function AdminConsole() {
  const [secret, setSecret] = useState('');
  const [name, setName] = useState('');
  const [venue, setVenue] = useState('');
  const [ttlHours, setTtlHours] = useState(36);
  const [sponsorTitle, setSponsorTitle] = useState('');
  const [sponsorBody, setSponsorBody] = useState('');
  const [sponsorCta, setSponsorCta] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  async function create() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/party', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': secret },
        body: JSON.stringify({
          name,
          venue,
          ttlHours,
          sponsorTitle,
          sponsorBody,
          sponsorCta,
          sponsorUrl,
        }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? `Błąd ${res.status}`);

      const qrDataUrl = await QRCode.toDataURL(payload.joinUrl, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: { dark: '#09090b', light: '#ffffff' },
      });

      setCreated({
        code: payload.party.code,
        name: payload.party.name,
        venue: payload.party.venue,
        expiresAt: payload.party.expires_at,
        joinUrl: payload.joinUrl,
        qrDataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć imprezy.');
    } finally {
      setBusy(false);
    }
  }

  if (created) {
    return (
      <main className="pm-shell">
        <header className="mb-5 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-400">
            Impreza utworzona
          </p>
          <h1 className="mt-2 text-2xl font-bold">{created.name}</h1>
          {created.venue && <p className="text-sm text-zinc-400">{created.venue}</p>}
        </header>

        <div className="pm-card overflow-hidden p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={created.qrDataUrl}
            alt={`Kod QR imprezy ${created.code}`}
            className="mx-auto w-full max-w-[280px] rounded-2xl bg-white p-3"
          />
          <p className="mt-4 text-center text-4xl font-black tracking-[0.28em] text-violet-300">
            {created.code}
          </p>
          <p className="mt-2 break-all text-center text-[11px] text-zinc-500">{created.joinUrl}</p>
          <p className="mt-3 text-center text-[11px] text-zinc-500">
            Wygasa: {new Date(created.expiresAt).toLocaleString('pl-PL')}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <a href={created.qrDataUrl} download={`partymatch-${created.code}.png`} className="pm-btn-ghost text-xs">
            <Download className="h-4 w-4" />
            PNG
          </a>
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(created.joinUrl)}
            className="pm-btn-ghost text-xs"
          >
            <Copy className="h-4 w-4" />
            Link
          </button>
          <button type="button" onClick={() => window.print()} className="pm-btn-ghost text-xs">
            <Printer className="h-4 w-4" />
            Drukuj
          </button>
        </div>

        <button type="button" onClick={() => setCreated(null)} className="pm-btn-primary mt-5 w-full py-4">
          Utwórz kolejną
        </button>
      </main>
    );
  }

  return (
    <main className="pm-shell">
      <header className="mb-5">
        <div className="flex items-center gap-2 text-violet-400">
          <QrCode className="h-5 w-5" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.24em]">
            Panel organizatora
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold">Nowa impreza</h1>
      </header>

      <div className="space-y-5">
        <div>
          <label className="pm-label" htmlFor="secret">Klucz organizatora</label>
          <input
            id="secret"
            type="password"
            className="pm-input"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="ADMIN_SECRET"
            autoComplete="off"
          />
        </div>

        <div>
          <label className="pm-label" htmlFor="pname">Nazwa imprezy</label>
          <input
            id="pname"
            className="pm-input"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 80))}
            placeholder="Neon Warehouse #42"
          />
        </div>

        <div>
          <label className="pm-label" htmlFor="venue">Lokal / miejsce</label>
          <input
            id="venue"
            className="pm-input"
            value={venue}
            onChange={(e) => setVenue(e.target.value.slice(0, 80))}
            placeholder="Klub Prozak, Kraków"
          />
        </div>

        <div>
          <label className="pm-label" htmlFor="ttl">
            Czas życia danych
            <span className="ml-2 font-normal normal-case tracking-normal text-zinc-500">
              {ttlHours} h (maks. 48)
            </span>
          </label>
          <input
            id="ttl"
            type="range"
            min={1}
            max={48}
            step={1}
            value={ttlHours}
            onChange={(e) => setTtlHours(Number(e.target.value))}
            className="w-full accent-violet-500"
          />
        </div>

        <fieldset className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <legend className="px-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            Karta sponsorowana (opcjonalnie)
          </legend>
          <div className="space-y-3 pt-2">
            <input
              className="pm-input text-sm"
              value={sponsorTitle}
              onChange={(e) => setSponsorTitle(e.target.value.slice(0, 60))}
              placeholder="Bar Deal: -20% na shoty"
            />
            <textarea
              className="pm-input min-h-[70px] resize-none text-sm"
              value={sponsorBody}
              onChange={(e) => setSponsorBody(e.target.value.slice(0, 200))}
              placeholder="Pokaż ten ekran przy barze do 2:00."
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="pm-input text-sm"
                value={sponsorCta}
                onChange={(e) => setSponsorCta(e.target.value.slice(0, 30))}
                placeholder="CTA"
              />
              <input
                className="pm-input text-sm"
                value={sponsorUrl}
                onChange={(e) => setSponsorUrl(e.target.value)}
                placeholder="https://…"
                inputMode="url"
              />
            </div>
          </div>
        </fieldset>
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={create}
        disabled={busy || secret.length < 8 || name.trim().length < 2}
        className="pm-btn-primary mt-6 w-full py-4 text-base"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <QrCode className="h-5 w-5" />}
        Wygeneruj kod QR
      </button>
    </main>
  );
}
