import Link from 'next/link';

export const metadata = { title: 'PartyMatch — Polityka prywatności' };

const CONTROLLER = process.env.NEXT_PUBLIC_CONTROLLER_NAME ?? '[NAZWA ADMINISTRATORA]';
const CONTACT = process.env.NEXT_PUBLIC_CONTROLLER_EMAIL ?? '[ADRES E-MAIL]';

export default function Privacy() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <Link href="/" className="text-xs text-violet-400 underline underline-offset-4">
        ← Wróć
      </Link>
      <h1 className="mt-4 text-3xl font-bold">Polityka prywatności</h1>
      <p className="mt-2 text-xs text-zinc-500">
        Wersja szablonowa. Przed uruchomieniem produkcyjnym musi ją zweryfikować prawnik —
        uzupełnij dane administratora, podmioty przetwarzające i ewentualne transfery poza EOG.
      </p>

      <div className="prose prose-invert mt-8 max-w-none space-y-6 text-sm leading-relaxed text-zinc-300">
        <Section title="1. Administrator danych">
          Administratorem danych osobowych jest {CONTROLLER}. Kontakt: {CONTACT}.
        </Section>

        <Section title="2. Jakie dane przetwarzamy">
          <ul className="list-disc space-y-1 pl-5">
            <li>selfie wykonane w aplikacji (dane biometryczne w rozumieniu art. 9 RODO wyłącznie w zakresie wizerunku);</li>
            <li>imię, wiek, status związku, cel obecności, bio, hobby;</li>
            <li>identyfikator sesji (losowy token w pamięci przeglądarki);</li>
            <li>zapisy swipe’ów, matchy i zgłoszeń moderacyjnych.</li>
          </ul>
          Nie zbieramy adresu e-mail, numeru telefonu ani danych lokalizacyjnych GPS.
        </Section>

        <Section title="3. Podstawa prawna">
          Art. 6 ust. 1 lit. a oraz art. 9 ust. 2 lit. a RODO — Twoja wyraźna, dobrowolna zgoda,
          wyrażona przed wykonaniem zdjęcia. Zgodę możesz wycofać w każdej chwili, usuwając profil
          w zakładce „Profil”. Wycofanie zgody nie wpływa na zgodność z prawem przetwarzania
          dokonanego wcześniej.
        </Section>

        <Section title="4. Okres przechowywania">
          Dane istnieją wyłącznie przez czas trwania wydarzenia i są trwale kasowane najpóźniej
          w momencie wygaśnięcia imprezy (maksymalnie 48 godzin od jej rozpoczęcia). Usunięcie
          obejmuje plik zdjęcia w magazynie obiektowym oraz wszystkie rekordy w bazie danych.
        </Section>

        <Section title="5. Odbiorcy danych">
          <ul className="list-disc space-y-1 pl-5">
            <li>Supabase (hosting bazy danych) — podmiot przetwarzający;</li>
            <li>Cloudflare R2 (magazyn zdjęć) — podmiot przetwarzający;</li>
            <li>dostawca hostingu aplikacji (Vercel / Cloudflare Pages);</li>
            <li>sieć reklamowa, jeżeli została włączona — wyłącznie dane niezbędne do wyświetlenia reklamy.</li>
          </ul>
          Twoje zdjęcie i profil są widoczne wyłącznie dla innych uczestników tej samej imprezy.
        </Section>

        <Section title="6. Twoje prawa">
          Masz prawo dostępu do danych, ich sprostowania (edycja profilu), usunięcia (przycisk
          „Usuń mój profil i zdjęcie”), ograniczenia przetwarzania, sprzeciwu oraz wniesienia skargi
          do Prezesa Urzędu Ochrony Danych Osobowych.
        </Section>

        <Section title="7. Moderacja i bezpieczeństwo">
          Każdy profil można zgłosić. Po przekroczeniu progu zgłoszeń profil jest natychmiast
          ukrywany dla wszystkich uczestników (mechanizm zgodny z art. 16 aktu o usługach
          cyfrowych — DSA).
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-base font-bold text-zinc-100">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
