import Link from 'next/link';
import { CalendarX2, QrCode } from 'lucide-react';
import { getParty } from '@/lib/party-server';
import PartyEntry from '@/components/PartyEntry';

export const dynamic = 'force-dynamic';

export default async function PartyPage({ params }: { params: { code: string } }) {
  const { party, activeCount, expired } = await getParty(params.code);

  if (!party) return <Notice icon={<QrCode className="h-9 w-9" />} title="Nie znaleziono imprezy"
    body="Ten kod nie istnieje. Sprawdź plakat lub zeskanuj kod QR jeszcze raz." />;

  if (expired) {
    return (
      <Notice
        icon={<CalendarX2 className="h-9 w-9" />}
        title="Impreza się skończyła"
        body={`„${party.name}” jest już zamknięta. Wszystkie profile i zdjęcia z tego wydarzenia zostały trwale usunięte.`}
      />
    );
  }

  return <PartyEntry party={party} activeCount={activeCount} />;
}

function Notice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <main className="pm-shell items-center justify-center text-center">
      <span className="mb-4 text-violet-400">{icon}</span>
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-400">{body}</p>
      <Link href="/" className="pm-btn-ghost mt-6">
        Wróć na start
      </Link>
    </main>
  );
}
