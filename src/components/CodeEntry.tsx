'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';

/** Manual fallback for people whose camera cannot read the printed QR. */
export default function CodeEntry() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const valid = /^[A-Z0-9-]{4,24}$/.test(code);

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    router.push(`/p/${code}`);
  }

  return (
    <form onSubmit={go} className="flex gap-2">
      <input
        className="pm-input text-center text-lg font-bold uppercase tracking-[0.3em]"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24))}
        placeholder="KOD"
        aria-label="Kod imprezy"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="go"
      />
      <button type="submit" disabled={!valid || busy} className="pm-btn-primary px-5" aria-label="Wejdź">
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
      </button>
    </form>
  );
}
