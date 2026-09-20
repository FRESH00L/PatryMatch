import Link from 'next/link';

export const metadata = { title: 'PartyMatch — Regulamin' };

export default function Terms() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/" className="text-xs text-violet-400 underline underline-offset-4">
        ← Wróć
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Regulamin</h1>
      <p className="mt-2 text-xs text-zinc-500">
        Szablon do uzupełnienia przez prawnika przed wdrożeniem produkcyjnym.
      </p>

      <ol className="mt-8 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-zinc-300">
        <li>
          <strong className="text-zinc-100">Wiek.</strong> Z aplikacji mogą korzystać wyłącznie
          osoby, które ukończyły 18 lat. Podanie nieprawdziwego wieku skutkuje usunięciem profilu.
        </li>
        <li>
          <strong className="text-zinc-100">Zdjęcie.</strong> Wolno wgrać wyłącznie własne selfie
          wykonane w aplikacji. Zakazane są zdjęcia innych osób, nagość, treści seksualne oraz
          materiały naruszające prawa osób trzecich.
        </li>
        <li>
          <strong className="text-zinc-100">Zachowanie.</strong> Match nie jest zgodą na kontakt
          fizyczny. Szanuj odmowę. Nękanie, groźby i mowa nienawiści oznaczają natychmiastowe
          usunięcie z wydarzenia.
        </li>
        <li>
          <strong className="text-zinc-100">Brak czatu.</strong> Aplikacja nie udostępnia
          komunikatora. Kontakt następuje wyłącznie osobiście, na terenie wydarzenia.
        </li>
        <li>
          <strong className="text-zinc-100">Efemeryczność.</strong> Profil, zdjęcie i matche znikają
          wraz z końcem imprezy. Nie przewidujemy przywracania danych.
        </li>
        <li>
          <strong className="text-zinc-100">Zgłoszenia.</strong> Każdy profil można zgłosić.
          Zgłoszenia są rozpatrywane automatycznie (ukrycie po przekroczeniu progu) oraz ręcznie
          przez organizatora wydarzenia.
        </li>
        <li>
          <strong className="text-zinc-100">Reklamy.</strong> Co dziesiąta karta w talii jest kartą
          sponsorowaną, wyraźnie oznaczoną etykietą „Sponsorowane / Ad”.
        </li>
        <li>
          <strong className="text-zinc-100">Odpowiedzialność.</strong> Aplikacja jedynie kojarzy
          uczestników. Za przebieg spotkań odpowiadają wyłącznie sami uczestnicy.
        </li>
      </ol>
    </main>
  );
}
