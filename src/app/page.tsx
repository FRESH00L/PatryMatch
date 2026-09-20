import Link from 'next/link';
import { QrCode, Timer, ShieldCheck, MessageSquareOff } from 'lucide-react';
import CodeEntry from '@/components/CodeEntry';

export default function Home() {
  return (
    <main className="pm-shell justify-between">
      <section className="pt-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-400">
          PartyMatch
        </p>
        <h1 className="mt-3 text-4xl font-black leading-[1.05]">
          Poznaj kogoś,
          <br />
          kto jest{' '}
          <span className="bg-gradient-to-r from-violet-400 to-emerald-400 bg-clip-text text-transparent">
            tu i teraz
          </span>
          .
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          Zeskanuj kod QR imprezy, zrób jedno selfie i swipuj ludzi, którzy są na tej samej
          imprezie co Ty. Bez konta, bez czatu, bez śladu po imprezie.
        </p>

        <div className="mt-8">
          <CodeEntry />
        </div>
      </section>

      <section className="mt-10 grid gap-3">
        <Feature
          icon={<QrCode className="h-4 w-4" />}
          title="Kod QR na miejscu"
          body="Do talii wchodzą wyłącznie osoby, które zeskanowały kod tej imprezy."
        />
        <Feature
          icon={<MessageSquareOff className="h-4 w-4" />}
          title="Zero czatu"
          body="Po matchu dostajecie ekran „znajdźcie się w tłumie”. Reszta dzieje się na parkiecie."
        />
        <Feature
          icon={<Timer className="h-4 w-4" />}
          title="Znika po imprezie"
          body="Zdjęcia i profile są trwale kasowane automatycznie po zakończeniu wydarzenia."
        />
        <Feature
          icon={<ShieldCheck className="h-4 w-4" />}
          title="18+ i RODO"
          body="Wyraźna zgoda na wizerunek, zgłaszanie profili i usunięcie danych jednym kliknięciem."
        />
      </section>

      <footer className="mt-10 flex items-center justify-center gap-4 text-[11px] text-zinc-600">
        <Link href="/legal/privacy" className="underline underline-offset-4">
          Prywatność
        </Link>
        <Link href="/legal/terms" className="underline underline-offset-4">
          Regulamin
        </Link>
      </footer>
    </main>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="pm-card flex gap-3 p-4">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
        {icon}
      </span>
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">{body}</p>
      </div>
    </div>
  );
}
