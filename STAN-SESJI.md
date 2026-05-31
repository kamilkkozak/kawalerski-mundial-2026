# Stan sesji — Kawalerski Mundial 2026 (handoff)

_Ostatnia aktualizacja: 2026-05-31. Plik do wznowienia pracy po restarcie komputera._

## Co to jest
Apka webowa do typowania meczów Mundialu 2026 dla grupy znajomych. Stack:
**Next.js 14 (App Router, TS) + Supabase (Postgres, Auth magic link, Realtime, RLS) + Vercel**.
Folder projektu: `d:\_CLAUDE\Mistrzostwa Świata 2026\mundial-app`.

## Co już DZIAŁA (zrobione i przetestowane)
- ✅ **Baza Supabase** skonfigurowana (projekt `wgptsqkwsvykmpmesduj`): schemat, RLS, RPC
  (`upsert_prediction`, `set_bonus`, `get_standings`, `admin_set_result`, `admin_set_bonus_result`),
  trigger zakładający gracza przy rejestracji. Migracje w `supabase/migrations/`.
- ✅ **104 mecze** w bazie: 72 grupowe + 32 pucharowe (r32→final), powiązane z football-data.org
  przez `ext_id`. Realtime włączony dla `matches/predictions/bonus_picks/settings`.
- ✅ **Auth magic link** działa (zalogowany: Kodżonek / kamilk.kozak@gmail.com, **admin**).
- ✅ **Front przepisany na design „Claude Design"** (motyw *clash* — złoto+granat), responsywny mobile.
  Widoki: Grupy (parowanie→modal), Faza grupowa (lock 60 s/mecz), Drabinka (view-only),
  Mistrz&Król, Wyniki&ranking, Zasady, Panel admina.
- ✅ **Cron** `/api/cron/sync-results` (football-data.org) — przetestowany, dopasował 72/72 grupowych,
  nie nadpisuje ręcznych korekt admina.
- ✅ **Build przechodzi czysto** (`npm run build`). Repo git zainicjowane, 1 commit.
- ⚠️ W bazie są jeszcze **dane DEMO** (3 fikcyjni gracze + 4 wyniki) — do podglądu UI.

## GDZIE JESTEŚMY TERAZ — deploy na Vercel (w toku)
Cel: publiczny link, żeby znajomi typowali z telefonów (lokalny `localhost:3001` nie działa na telefonie).

**Problem napotkany:** `404: DEPLOYMENT_NOT_FOUND` — otwarty został adres bez żywego deploymentu
(prawdopodobnie był tylko `vercel` = preview, bez `vercel --prod`).

### Następne kroki (do zrobienia po restarcie, w terminalu w folderze `mundial-app`)
```bash
npm i -g vercel        # jeśli nie zainstalowane
vercel login           # logowanie przez przeglądarkę
vercel --prod          # PRODUKCYJNY deploy — otwórz DOKŁADNIE adres z konsoli
vercel ls              # podgląd deploymentów, gdyby coś nie grało
```
Następnie:
1. **Env na Vercel** (Settings → Environment Variables) — 5 kluczy, wartości z `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `FOOTBALL_DATA_API_KEY`, `CRON_SECRET`. (`NEXT_PUBLIC_SITE_URL` niepotrzebny.)
2. **Supabase → Authentication → URL Configuration**: Site URL = `https://TWOJA-APKA.vercel.app`,
   Redirect URLs → dodaj `https://TWOJA-APKA.vercel.app/**`.
3. Po deployu **wkleić Claude'owi adres produkcyjny** — sprawdzę, że wstało i magic link działa.

Pełna instrukcja: `DEPLOY.md`.

## Otwarte wątki / do decyzji
- ⚠️ **Cron na planie Hobby (darmowym)** = ~1×/dzień, więc auto-wyniki co 5 min NIE zadziałają.
  Opcje: Vercel Pro / **darmowy GitHub Actions cron** (Claude może przygotować) / ręczne wyniki admina.
- 🔒 **BEZPIECZEŃSTWO:** skrypty w `scripts/*.mjs` mają **hasło do bazy** wpisane jako domyślny
  connection string. Przed wypchnięciem repo na GitHub: usunąć hardcode (czytać z argv/env) albo
  zrotować hasło DB w Supabase. (Vercel CLI wgrywa folder bez gita, więc do samego deployu to nie blokuje.)
- 🧹 **Dane demo** — sprzątanie: `node scripts/demo-clean.mjs`.
- 🏆 **Typowanie pucharowe** — na razie drabinka jest view-only; włączymy gdy pary będą znane.

## Jak wznowić lokalny dev po restarcie
```bash
cd "d:/_CLAUDE/Mistrzostwa Świata 2026/mundial-app"
npm run dev            # http://localhost:3001 (port przypięty w package.json)
```
`.env.local` ma już wszystkie klucze (Supabase URL/anon/service_role, football-data, CRON_SECRET).

## Skrypty pomocnicze (Node, łączą się z bazą; connection string = domyślny argument)
- `node supabase/generate-seed.mjs` — regeneruje `seed_fixtures.sql` z prototypu.
- `node scripts/db-setup.mjs` — wgrywa schemat+RLS+seed (idempotentne).
- `node scripts/seed-knockout.mjs` — seeduje 32 mecze pucharowe z API.
- `node scripts/demo-seed.mjs` / `demo-clean.mjs` — wstaw / usuń dane demo.

## Kluczowe pliki
- `app/page.tsx` — server: ładuje dane, renderuje `AppShell`.
- `components/AppShell.tsx` — sidebar/topbar/routing/realtime/modal/mobile.
- `components/` — `GroupBoard`, `MatchList`+`MatchCard`, `KnockoutBracket`, `SpecialBets`,
  `ResultsView`, `AdminView`, `RulesView`, `PredictionModal`, `Flag`, `Avatar`, `icons`.
- `lib/` — `scoring` (3/1/0 + lock 60 s), `flags` (nazwa→kod), `stages`, `footballdata`, `teams`, `ui`,
  `supabase/{client,server,middleware}`.
- `app/globals.css` — system wizualny designu (motyw clash + responsywność).
- `supabase/migrations/` + `seed_fixtures.sql` — baza.

## Zasada projektu (ważne przy dalszych zmianach)
Backend = źródło prawdy. Z designu bierzemy TYLKO wygląd. Lock typów: **per mecz, 60 s, serwerowo**
(`upsert_prediction`) — NIE „na cały dzień". Punktacja 3/1/0 + 10/10 liczona w SQL (`get_standings`).
Pula: wpisowe 50 zł, nagrody 250/125/75. Nigdy localStorage jako źródło typów.
