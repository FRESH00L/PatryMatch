import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="pm-shell items-center justify-center text-center">
      <Compass className="mb-4 h-9 w-9 text-violet-400" />
      <h1 className="text-2xl font-bold">Nie ma tu nic</h1>
      <p className="mt-2 max-w-xs text-sm text-zinc-400">
        Ten adres nie istnieje albo impreza już się skończyła.
      </p>
      <Link href="/" className="pm-btn-ghost mt-6">
        Wróć na start
      </Link>
    </main>
  );
}
