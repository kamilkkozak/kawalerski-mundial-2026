# Kawalerski Mundial 2026 ⚽

Apka do typowania meczów Mundialu 2026 dla grupy znajomych. Next.js + Supabase + Vercel.
Logika punktacji (3/1/0 + 10/10), blokada 60 s przed gwizdkiem (walidacja serwerowa),
tabela na żywo (realtime), panel admina, auto-pobieranie wyników z football-data.org.

## Stack
- **Next.js 14** (App Router) + TypeScript + Tailwind
- **Supabase** — Postgres, auth (magic link), realtime, RLS
- **Vercel** — hosting + Cron (auto-sync wyników)

---

## 1. Konfiguracja Supabase

1. Wejdź w swój projekt → **SQL Editor** i uruchom po kolei:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_functions_rls.sql`
   - `supabase/seed_fixtures.sql` (72 mecze fazy grupowej; regeneracja: `node supabase/generate-seed.mjs`)

2. **Auth → Providers → Email**: włącz „Email" i opcję magic link. Wyłącz „Confirm email"
   jeśli chcesz logowanie jednym kliknięciem (magic link i tak weryfikuje adres).

3. **Auth → URL Configuration**: ustaw `Site URL` (np. `http://localhost:3000` lokalnie,
   a po deployu adres z Vercela) oraz dodaj do `Redirect URLs`:
   `http://localhost:3000/auth/callback` i `https://TWOJA-APKA.vercel.app/auth/callback`.

4. **Project Settings → API**: skopiuj `Project URL`, `anon key` i `service_role key`.

## 2. Zmienne środowiskowe

Skopiuj `.env.example` → `.env.local` i uzupełnij:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # tylko serwer (cron/admin)
FOOTBALL_DATA_API_KEY=...            # darmowy klucz z football-data.org
CRON_SECRET=...                      # długi losowy ciąg
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## 3. Uruchomienie lokalne

```bash
npm install
npm run dev      # http://localhost:3000
```

Zaloguj się (magic link na e-mail). Wiersz w tabeli `players` tworzy się automatycznie.

### Zrób siebie adminem
Po pierwszym logowaniu, w Supabase SQL Editor:
```sql
update public.players set is_admin = true where email = 'twoj@email.com';
```
Pojawi się zakładka **Admin** (korekta wyników + wynik bonusów).

## 4. Realtime (tabela na żywo)
W Supabase → **Database → Replication** (lub Realtime) włącz publikację `supabase_realtime`
dla tabel: `matches`, `predictions`, `bonus_picks`, `settings`. Wtedy tabela i wyniki
odświeżają się u wszystkich bez przeładowania.

## 5. Deploy na Vercel
1. Wrzuć repo na GitHub, zaimportuj w Vercel.
2. W Vercel → **Settings → Environment Variables** dodaj wszystkie zmienne z `.env.local`
   (zmień `NEXT_PUBLIC_SITE_URL` na adres produkcyjny).
3. `vercel.json` definiuje Cron `/api/cron/sync-results` co 5 min. Vercel automatycznie
   dodaje nagłówek z `CRON_SECRET`? **Nie** — ustaw w Vercel Cron autoryzację albo
   trzymaj `CRON_SECRET` w env; endpoint sprawdza `Authorization: Bearer <CRON_SECRET>`.
   (Na planie Hobby cron wywoła endpoint z tym sekretem, jeśli dodasz go w env i w nagłówku
   Cron Jobs → Authorization.)

### Ręczny test crona
```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://TWOJA-APKA.vercel.app/api/cron/sync-results
```
Zwraca `{ fetched, linked, updated, unmatched }`. `unmatched` = mecze z API, których nie
udało się automatycznie dopasować (uzupełnij aliasy w `lib/footballdata.ts` lub wpisz wynik
ręcznie w panelu admina).

---

## Architektura — kluczowe decyzje
- **Walidacja blokady po stronie serwera**: zapis typu idzie WYŁĄCZNIE przez funkcję
  Postgres `upsert_prediction` (SECURITY DEFINER), która odrzuca zapis po `kickoff − 60 s`.
  Tabela `predictions` nie ma polityk INSERT/UPDATE — UI nie da się obejść.
- **Widoczność cudzych typów**: RLS odsłania typy innych graczy dopiero po blokadzie meczu
  (bonusy — po starcie turnieju).
- **Punktacja w SQL**: funkcja `get_standings()` liczy punkty 3/1/0 + bonusy 10/10.
- **Wyniki**: cron z football-data.org; status `FINISHED` zapisuje wynik. Ręczna korekta
  admina ma priorytet (cron nie nadpisuje meczu oznaczonego `FINISHED`).
- **Mecze pucharowe**: seed zawiera fazę grupową. Pary pucharowe dodasz po losowaniu
  (kolejny seed lub panel admina) — schemat ma `stage` z wartościami r32/r16/qf/sf/third/final.
