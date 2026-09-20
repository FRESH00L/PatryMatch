# PartyMatch

Efemeryczna PWA do poznawania ludzi **na konkretnej imprezie**. Skanujesz kod QR, robisz jedno
selfie, wypełniasz mini-profil, swipujesz osoby obecne w tym samym miejscu. Match = pełnoekranowy
komunikat „znajdźcie się w tłumie”. Bez konta, bez czatu, bez śladu po imprezie.

---

## 1. Architektura

```
                        ┌──────────────────────────────────────────┐
                        │   PLAKAT / OPASKA / EKRAN W KLUBIE       │
                        │   QR  ->  https://app.pl/p/NEON42        │
                        └────────────────────┬─────────────────────┘
                                             │ skan
                                             ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│  PRZEGLĄDARKA (PWA, Next.js App Router + Framer Motion)                        │
│                                                                                │
│  /p/[code]            zgoda 18+ i RODO  ->  aparat  ->  formularz profilu       │
│  /p/[code]/deck       talia kart (swipe) + karta reklamowa co 10 profili        │
│  /p/[code]/matches    lista matchy                                             │
│  /p/[code]/profile    zmiana zdjęcia / danych, usunięcie profilu               │
│                                                                                │
│  session_token  ->  localStorage  ->  nagłówek  x-session-token                │
└───────┬───────────────────────────────┬───────────────────────────┬───────────┘
        │ 1. POST /api/upload-url       │ 3. REST (Route Handlers)  │ 4. WSS
        │    (podpis, 120 s)            │                           │
        ▼                               ▼                           ▼
┌────────────────────┐   ┌──────────────────────────────┐   ┌───────────────────┐
│  Next.js Route     │   │  Next.js Route Handlers      │   │ Supabase Realtime │
│  Handler (Node)    │   │  /api/profile  (CRUD)        │   │ postgres_changes  │
│  presign PUT       │   │  /api/deck     (RPC)         │   │ INSERT on matches │
│  AWS SDK v3 / S3   │   │  /api/swipe                  │   │ (anon key, RLS)   │
└─────────┬──────────┘   │  /api/matches                │   └─────────┬─────────┘
          │              │  /api/report                 │             │
          │              │  /api/cron/cleanup           │             │
          │              │  /api/admin/party            │             │
          │              └───────────────┬──────────────┘             │
          │ 2. PUT (WebP <100 KB)        │ service_role                │
          │    bezpośrednio, bez proxy   │ (omija RLS)                 │
          ▼                              ▼                             │
┌────────────────────┐        ┌──────────────────────────────────────┐ │
│  CLOUDFLARE R2     │        │  SUPABASE POSTGRES                   │◄┘
│  parties/<kod>/    │        │                                      │
│    <uuid>.webp     │        │  parties · profiles · swipes         │
│  zero egress       │        │  matches · reports · deletion_queue  │
│                    │        │                                      │
│  publiczny odczyt  │◄───────┤  TRIGGERY:                           │
│  przez CDN         │ DELETE │   trg_detect_match   (match auto)    │
└────────────────────┘        │   trg_apply_report   (DSA hide)      │
          ▲                   │   trg_profile_photo_gc (kolejka R2)  │
          │                   │   trg_swipes_same_party (izolacja)   │
          │                   │  RPC: fn_get_deck (SECURITY DEFINER) │
          │                   └──────────────────┬───────────────────┘
          │                                      │
          │      ┌───────────────────────────────┴──────────────┐
          └──────┤  CRON co 15 min (Vercel Cron lub pg_cron)     │
                 │  /api/cron/cleanup                            │
                 │   1. zbierz photo_key wygasłych imprez        │
                 │   2. skasuj obiekty w R2                      │
                 │   3. DELETE FROM parties (kaskada)            │
                 │   4. opróżnij deletion_queue                  │
                 └───────────────────────────────────────────────┘
```

### Ścieżka danych jednego swipe’a

```
użytkownik A przesuwa w prawo na B
      │
      ├─ POST /api/swipe {targetId: B, direction: like}
      │        └─ INSERT swipes  ──► trg_swipes_same_party (walidacja imprezy)
      │                          ──► trg_detect_match
      │                                 └─ czy istnieje like B→A?
      │                                        tak ──► INSERT matches (u1<u2)
      │
      ├─ odpowiedź HTTP: {match: {...}}   ← A widzi ekran matcha natychmiast
      │
      └─ Realtime INSERT na matches (filter: party_id)
               └─ przeglądarka B odbiera zdarzenie ──► GET /api/matches
                                                  ──► ekran matcha u B
               (fallback: polling co 15 s, gdy klubowe wifi blokuje websockety)
```

### Dlaczego tak

| Decyzja | Powód |
|---|---|
| Zdjęcie idzie z przeglądarki **prosto do R2** | Nasz serwer nigdy nie dotyka bajtów obrazu — mniej ruchu, mniej ryzyka, brak limitów body na Vercelu. |
| Kompresja **po stronie klienta** do <100 KB | Klubowe LTE bywa fatalne. WebP 720×960 to ~40–80 KB zamiast 3 MB z aparatu. |
| Wszystkie zapisy przez **service_role** w Route Handlers | Klient nigdy nie pisze do bazy bezpośrednio, więc reguły biznesowe (izolacja imprezy, walidacja) są nie do obejścia. |
| `anon` widzi tylko `matches` (same UUID) | Realtime działa, ale nie da się wyciągnąć niczyjego profilu bez tokenu sesji. |
| Match tworzy **trigger**, nie kod aplikacji | Wyścig dwóch równoczesnych „like” rozstrzyga baza; `UNIQUE(user1_id,user2_id)` + kanoniczne sortowanie UUID gwarantują jeden match. |
| Brak czatu | Wymaganie produktowe — i jednocześnie zdejmuje z projektu cały ciężar moderacji treści prywatnych. |

---

## 2. Struktura repozytorium

```
partymatch/
├─ supabase/schema.sql          ← cały schemat + triggery + RLS + cron (idempotentny)
├─ src/
│  ├─ app/
│  │  ├─ page.tsx                       landing + ręczne wpisanie kodu
│  │  ├─ p/[code]/page.tsx              zgoda -> aparat -> profil
│  │  ├─ p/[code]/deck/page.tsx         talia
│  │  ├─ p/[code]/matches/page.tsx      matche
│  │  ├─ p/[code]/profile/page.tsx      ustawienia + usunięcie danych
│  │  ├─ admin/page.tsx                 panel organizatora (generator QR)
│  │  ├─ legal/{privacy,terms}/page.tsx szablony RODO/regulaminu
│  │  └─ api/…                          Route Handlers
│  ├─ components/
│  │  ├─ CameraCapture.tsx     aparat, podgląd, akceptuj / powtórz
│  │  ├─ JoinFlow.tsx          onboarding (zgody, zdjęcie, dane)
│  │  ├─ SwipeDeck.tsx         gesty Framer Motion + wstrzykiwanie reklam
│  │  ├─ ProfileCard.tsx       karta profilu + stemple TAK/NIE
│  │  ├─ AdCard.tsx            karta sponsorowana / AdSense
│  │  ├─ MatchScreen.tsx       „znajdźcie się w tłumie”
│  │  ├─ ReportSheet.tsx       zgłoszenie DSA
│  │  └─ …
│  └─ lib/
│     ├─ image.ts              kompresja WebP + upload presigned (klient)
│     ├─ r2.ts                 presign / delete (serwer)
│     ├─ session.ts            walidacja tokenu sesji (serwer)
│     ├─ client-session.ts     localStorage + fetch wrapper (klient)
│     └─ supabase-{server,browser}.ts
└─ vercel.json                 cron co 15 min
```

---

## 3. Konfiguracja krok po kroku

### 3.1 Supabase

1. Załóż projekt na <https://supabase.com> (region **eu-central-1 / Frankfurt** — dane zostają w UE).
2. `SQL Editor` → `New query` → wklej całą zawartość `supabase/schema.sql` → **Run**.
   Skrypt jest idempotentny; można go uruchamiać wielokrotnie.
3. `Database` → `Replication` → sprawdź, że publikacja `supabase_realtime` zawiera tabelę
   `matches` (skrypt dodaje ją automatycznie).
4. `Project Settings` → `API` → skopiuj:
   - `Project URL` → `https://dmmxdyigfehumcnyjssv.supabase.co/rest/v1/`
   - `anon public` → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtbXhkeWlnZmVodW1jbnlqc3N2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5MDM3MzMsImV4cCI6MjEwNTQ3OTczM30.PZo47YacTTUR3BzbIQbqxTNSW0UtVB9ZV2k6-ijkkzk`
   - `service_role` → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtbXhkeWlnZmVodW1jbnlqc3N2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTkwMzczMywiZXhwIjoyMTA1NDc5NzMzfQ.GMoWeV0xHrp9FeQuNGBEQChFATl6iKy9HjloUPYPasY` **(sekret, nigdy do przeglądarki)**

> Skrypt zakłada rozszerzenia `pgcrypto`, `pg_cron` i `pg_net`. Na darmowym planie `pg_cron`
> bywa niedostępny — wtedy pomiń sekcję 8 skryptu i użyj Vercel Cron (punkt 3.3).

### 3.2 Cloudflare R2

1. Cloudflare Dashboard → **R2** → `Create bucket` → nazwa np. `partymatch-photos`,
   lokalizacja **EU**.
2. Ustaw publiczny odczyt jedną z dwóch dróg:
   - **Szybko:** `Settings` → `Public Development URL` → `Allow Access`. Dostajesz
     `https://pub-xxxx.r2.dev`.
   - **Produkcyjnie:** `Settings` → `Custom Domains` → `Connect Domain` → `cdn.twojadomena.pl`.
     Cloudflare doda rekord CNAME automatycznie, jeśli domena jest w tym samym koncie.
3. `R2` → `Manage API Tokens` → `Create API Token`:
   - uprawnienia: **Object Read & Write**
   - zakres: tylko ten bucket
   - zapisz `Access Key ID` i `Secret Access Key`
4. **CORS** (wymagane — przeglądarka wysyła PUT bezpośrednio):
   `bucket` → `Settings` → `CORS Policy` → wklej:

   ```json
   [
     {
       "AllowedOrigins": ["https://twojadomena.pl", "http://localhost:3000"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["content-type"],
       "ExposeHeaders": ["etag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

5. Zmienne: `R2_ACCOUNT_ID` (widoczny w URL dashboardu), `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`.

### 3.3 Vercel

1. `vercel` CLI albo import repo w panelu.
2. `Settings` → `Environment Variables` → wklej wszystko z `.env.example`
   (Production **i** Preview).
3. `vercel.json` w repo konfiguruje cron `*/15 * * * *` na `/api/cron/cleanup`.
   Vercel wysyła nagłówek `Authorization: Bearer $CRON_SECRET`, który endpoint weryfikuje.
   > Darmowy plan Vercela pozwala na cron **raz dziennie**. Na Hobby ustaw `"schedule": "0 5 * * *"`
   > albo przenieś harmonogram do `pg_cron` (sekcja 8 `schema.sql`) lub Cloudflare Workers Cron.
4. `Settings` → `Domains` → dodaj `twojadomena.pl`.

### 3.4 DNS

| Rekord | Nazwa | Wartość | Uwaga |
|---|---|---|---|
| A | `@` | `76.76.21.21` | apex → Vercel |
| CNAME | `www` | `cname.vercel-dns.com` | |
| CNAME | `cdn` | (podaje Cloudflare R2) | domena zdjęć |

Jeżeli DNS trzymasz w Cloudflare, ustaw rekordy Vercela jako **DNS only** (szara chmurka) —
podwójne proxy psuje wystawianie certyfikatu.

### 3.5 Uruchomienie lokalne

```bash
npm install
cp .env.example .env.local     # uzupełnij wartości
npm run dev                    # http://localhost:3000
```

> **Aparat wymaga bezpiecznego kontekstu.** `localhost` jest traktowany jako bezpieczny.
> Testując z telefonu po adresie IP, użyj tunelu HTTPS (`npx localtunnel --port 3000`
> lub `cloudflared tunnel`) — inaczej `getUserMedia` nie ruszy.

### 3.6 Pierwsza impreza

1. Wejdź na `/admin`, podaj `ADMIN_SECRET`, nazwę i miejsce, ustaw TTL (1–48 h),
   opcjonalnie kartę sponsorowaną.
2. Pobierz PNG z kodem QR albo wydrukuj stronę.
3. Kod QR prowadzi na `https://twojadomena.pl/p/<KOD>`.

Alternatywnie z terminala:

```bash
curl -X POST https://twojadomena.pl/api/admin/party \
  -H "content-type: application/json" \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -d '{"name":"Neon Warehouse #42","venue":"Klub Prozak","ttlHours":36}'
```

---

## 4. Zmienne środowiskowe

| Zmienna | Gdzie | Opis |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | klient+serwer | URL projektu Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | klient | wyłącznie Realtime na `matches` |
| `SUPABASE_SERVICE_ROLE_KEY` | **serwer** | omija RLS — nigdy nie eksponuj |
| `R2_ACCOUNT_ID` | serwer | ID konta Cloudflare |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | serwer | token R2 (Object R/W) |
| `R2_BUCKET` | serwer | nazwa bucketu |
| `R2_PUBLIC_BASE_URL` | serwer | publiczny prefiks URL zdjęć |
| `ADMIN_SECRET` | serwer | dostęp do tworzenia imprez |
| `CRON_SECRET` | serwer | autoryzacja `/api/cron/cleanup` |
| `NEXT_PUBLIC_ADSENSE_CLIENT` / `_SLOT` | klient | opcjonalnie — reklama sieciowa |
| `NEXT_PUBLIC_CONTROLLER_NAME` / `_EMAIL` | klient | dane administratora na stronie RODO |

---

## 5. Reklamy

`SwipeDeck` wstrzykuje kartę reklamową **po każdych 10 profilach** (`AD_EVERY` w
`src/lib/shared.ts`). Kolejka nigdy nie kończy się reklamą — inaczej wyglądałaby jak koniec talii.

Dostępne sloty (`buildAdSlots`):

1. **Karta sponsora lokalu** — pola `sponsor_*` w tabeli `parties`, ustawiane w `/admin`.
2. **Slot sieciowy (AdSense in-feed)** — aktywny tylko gdy ustawisz `NEXT_PUBLIC_ADSENSE_CLIENT`
   i `NEXT_PUBLIC_ADSENSE_SLOT`; wymaga dodania skryptu AdSense w `layout.tsx`.

Gdy nie skonfigurujesz żadnego, talia po prostu nie zawiera reklam.

Każda karta ma stały nagłówek **„Sponsorowane · Ad”**, inną ramkę niż profil i nie da się jej
polubić (przycisk serca jest wyłączony) — to wymóg polityk sieci reklamowych i zabezpieczenie
przed przypadkowym kliknięciem.

---

## 6. RODO / DSA — co jest zaimplementowane

| Wymóg | Realizacja |
|---|---|
| Wyraźna zgoda na wizerunek (art. 9 RODO) | Dwa oddzielne checkboxy przed uruchomieniem aparatu; bez nich API odrzuca `POST /api/profile`. Zapisywane w `consent_photo` + `consent_at`. |
| Bramka 18+ | Checkbox + `CHECK (age >= 18)` w bazie + walidacja w API. |
| Minimalizacja danych | Brak e-maila, telefonu, GPS. Sesja to losowy token, nie konto. |
| Ograniczenie czasowe | `expires_at` maks. 48 h (twardy limit w kodzie `/api/admin/party`). |
| Prawo do bycia zapomnianym | `DELETE /api/profile` — najpierw obiekt w R2, potem kaskadowe usunięcie wierszy. |
| Automatyczne czyszczenie | Cron co 15 min: R2 → baza → kolejka `deletion_queue`. Fallback `fn_purge_expired()` w `pg_cron`. |
| Moderacja DSA | `ReportSheet` → `reports` → `trg_apply_report` ukrywa profil po 2 zgłoszeniach; zgłaszający od razu przestaje go widzieć. |
| Izolacja imprez | `fn_get_deck` (SECURITY DEFINER) + `trg_swipes_same_party`. |

**Do zrobienia przed produkcją:** teksty w `/legal/privacy` i `/legal/terms` to szablony —
muszą przejść przez prawnika, trzeba uzupełnić administratora danych, umowy powierzenia
z Supabase i Cloudflare oraz ocenę skutków (DPIA) dla przetwarzania wizerunku.

---

## 7. Znane ograniczenia / co dalej

- **Brak weryfikacji „selfie na żywo”.** Ktoś może sfotografować cudze zdjęcie z ekranu.
  Realna obrona to liveness detection (np. losowy gest) — świadomie poza zakresem MVP.
- **Ikony PWA.** `manifest.ts` wskazuje na `/icon-192.png`, `/icon-512.png`,
  `/icon-maskable.png` — wrzuć je do `public/`, inaczej instalacja PWA nie zaproponuje ikony.
- **Rate limiting.** Endpointy nie mają limitu zapytań. Na produkcji dołóż Vercel Firewall
  albo Upstash Ratelimit na `/api/upload-url` i `/api/profile`.
- **Skala talii.** `fn_get_deck` pobiera do 60 profili naraz i sortuje po `created_at`.
  Przy imprezie >2000 osób warto dołożyć losowanie z okna (`TABLESAMPLE` albo kursor).

---

## 8. Skrypty

```bash
npm run dev         # serwer deweloperski
npm run build       # build produkcyjny
npm run start       # uruchomienie builda
npm run lint        # ESLint (next/core-web-vitals)
npm run typecheck   # tsc --noEmit
```


P4RtyH1nG33!#   P a t r y M a t c h  
 