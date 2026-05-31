# Deploy na Vercel — Kawalerski Mundial 2026

Repo git jest już zainicjowane w tym folderze (`mundial-app`), pierwszy commit zrobiony.
`.env.local` jest w `.gitignore` — sekrety nie trafią do repo ani na Vercel z repo.

## Krok 1 — zaloguj się i wdróż (w terminalu, w folderze `mundial-app`)

```bash
npm i -g vercel        # albo używaj "npx vercel ..."
vercel login           # wybierz metodę, potwierdź w przeglądarce
vercel                 # pierwszy deploy (preview)
```

Przy `vercel` zaakceptuj domyślne:
- *Set up and deploy?* → **Y**
- *Which scope?* → Twoje konto
- *Link to existing project?* → **N**
- *Project name?* → `kawalerski-mundial-2026` (lub własna)
- *In which directory is your code?* → `./`
- Framework **Next.js** wykryje się sam; ustawienia build zostaw domyślne.

## Krok 2 — zmienne środowiskowe (Vercel → Project → Settings → Environment Variables)

Wklej te klucze (wartości skopiuj ze swojego `.env.local`). Zaznacz wszystkie środowiska (Production/Preview/Development):

| Klucz | Skąd |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | z `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | z `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | z `.env.local` (sekret) |
| `FOOTBALL_DATA_API_KEY` | z `.env.local` |
| `CRON_SECRET` | z `.env.local` |

> `NEXT_PUBLIC_SITE_URL` **nie jest wymagany** — apka używa adresu, pod którym ją otworzysz
> (`window.location.origin`), więc magic link zadziała na domenie z Vercela automatycznie.

## Krok 3 — produkcyjny deploy

```bash
vercel --prod
```

Zapisz adres, który zwróci (np. `https://kawalerski-mundial-2026.vercel.app`).

## Krok 4 — Supabase (jednorazowo, dla domeny produkcyjnej)

Authentication → **URL Configuration**:
- **Site URL**: `https://TWOJA-APKA.vercel.app`
- **Redirect URLs** → dodaj: `https://TWOJA-APKA.vercel.app/**`

Bez tego magic link odbije się na etapie powrotu (Supabase blokuje nieznane adresy).

## Krok 5 — udostępnij znajomym

Wyślij link `https://TWOJA-APKA.vercel.app`. Każdy wpisuje imię + e-mail → dostaje magic link → gra.
Admina nadajesz w bazie:
```sql
update public.players set is_admin = true where email = '...';
```

---

## Cron (auto-pobieranie wyników) — uwaga o planie

`vercel.json` ma zaplanowany cron `/api/cron/sync-results` co 5 min, a endpoint sam sprawdza
nagłówek `Authorization: Bearer <CRON_SECRET>` (Vercel dokłada go automatycznie, gdy ustawisz
zmienną `CRON_SECRET`).

**Plan Hobby (darmowy) ogranicza crony do ~1×/dzień.** Na czas turnieju są opcje:
1. **Vercel Pro** — pełny harmonogram co 5 min.
2. **Darmowy zewnętrzny cron** (np. cron-job.org / GitHub Actions) wołający co 5 min:
   ```
   curl -H "Authorization: Bearer <CRON_SECRET>" https://TWOJA-APKA.vercel.app/api/cron/sync-results
   ```
3. Ręczne wyniki w panelu admina (zawsze działa).

Daj znać — mogę przygotować gotowy workflow GitHub Actions (darmowy cron co 5 min).
