# Wyniki LIVE z Varzesh3 — stan wdrożenia (handoff)

> Aktualizacja 2026-06-21 (ETAP 1 zaliczony): kod **wdrożony na prod** (CLI deploy, inert), **geo OK** —
> serwer USA (WebFetch) dosięga i worldcup26.ir, i Varzesh3; wybrane źródło: **Varzesh3** (worldcup26.ir
> odpada: wolny 9,5 s, niestabilny, lag ~1 dzień, brak live). Cron live **wpięty** do
> `.github/workflows/sync-results.yml` (drugi krok → `/api/cron/sync-live`, reużywa istniejących
> sekretów GitHub `CRON_SECRET`+`APP_URL`). **ZOSTAŁO: commit + push** (i opcjonalnie ręczne odpalenie
> workflow w zakładce Actions = definitywny test geo z Vercela + start live). Endpoint `wc26-ping` usunięty.

## Po co to / dlaczego Varzesh3

Cel: automatyczne **wyniki LIVE w trakcie meczu** (dziś admin wpisuje je ręcznie, bo football-data.org na darmowym planie nie podaje wyniku live — `fullTime` jest `null` przez cały mecz).

Droga do źródła:
- **API-Football** — odpada. Darmowy plan NIE ma sezonu 2026 (sprawdzone, błąd „Free plans do not have access to this season, try from 2022 to 2024"). Patrz `memory/project_stats_module_todo.md`.
- **worldcup26.ir** (repo `rezarahiminia/worldcup2026`) — hostowane API lagowało ~1 dzień, brak realnego live. ALE jego silnik (`scripts/auto-updater.js`) zdradził prawdziwe źródło:
- **Varzesh3** ✅ — irański portal, wewnętrzne API `web-api.varzesh3.com`, **darmowe, bez klucza**, aktualizuje co ~3 s w trakcie meczu. To jest źródło, którego używamy.

## Podział odpowiedzialności (ważne)

- **Varzesh3 → wynik W TRAKCIE meczu** (ustawia status `IN_PLAY` + bramki). Zastępuje ręczne klepanie.
- **football-data.org / admin → wynik KOŃCOWY** (`FINISHED`). Varzesh3 tego **NIE** rusza (nie nadpisujemy meczów już FINISHED).
- Moduł jest **izolowany** (try/catch). Jak Varzesh3 padnie / zmieni format / zablokuje geo — apka leci dalej na football-data + ręcznych wynikach.

## API Varzesh3 — szczegóły techniczne

- Endpoint dnia: `https://web-api.varzesh3.com/v2.0/livescore/today` oraz `.../v2.0/livescore/{offset}` (offset = liczba dni, np. `-1`, `1`).
- **Wymaga nagłówka User-Agent przeglądarki** — bez niego zwraca HTML zamiast JSON (blok). (Node `fetch` bez UA = blok; `curl` z UA = OK.)
- Odpowiedź = tablica lig. **World Cup = liga `id === 28`** (tytuł „جام جهانی - گروهی").
- Struktura meczu: `{ id, host:{name(perski)}, guest:{name}, goals:{host,guest}, status, isLive, liveTime }`.
- `status`: **7 = zakończony**, **1 = przed gwizdkiem**. `isLive: true` = trwa.
- Strefa czasowa: „dzień" Varzesh3 to czas Iranu (UTC+3:30), mecze w Amerykach → pobieramy offsety **−1/0/+1** i dedupujemy po `id`, żeby nie zgubić meczu na granicy doby.

## Co zostało zrobione (pliki)

1. **`lib/varzesh3.ts`** (NOWY) — klient + orchestrator:
   - `FA_TO_EN` — mapa perski→angielski, 52 warianty (z `football.teams.json` + `data/team-name-map.json` z repo), pokrywa wszystkie 48 drużyn. en→pl robi istniejące `toPl` z `lib/footballdata.ts` (jedno źródło prawdy).
   - `faToPl(faName)` — perski→polski; `null` dla nieznanej drużyny.
   - `syncLiveScores(supabase, { dryRun })` — pobiera ligę 28 (offsety −1/0/+1), mapuje nazwy, **wyrównuje wynik do naszej kolejności team1/team2** (Varzesh3 ma własną host/guest), aktualizuje TYLKO mecze `isLive` które w bazie nie są `FINISHED`. Strażnik: w trybie nie-dry pomija fetch, gdy żaden mecz nie jest w oknie live (−5 min … +150 min od gwizdka). `dryRun` = nic nie zapisuje, zwraca pełny raport porównawczy.
2. **`app/api/cron/sync-live/route.ts`** (NOWY) — endpoint crona, auth `Authorization: Bearer <CRON_SECRET>`, param `?dry=1`. Niezależny od `sync-results` (można wołać częściej).
3. **`lib/footballdata.ts`** (ZMIANA) — dodany alias `"Democratic Republic of the Congo": "DR Konga"`.

## Jak zweryfikowano lokalnie (działa)

Dev na porcie 3001. Komenda (Git Bash):
```bash
CRON=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2- | tr -d '\r"')
# DRY-RUN (zawsze pobiera, nic nie pisze, pełny raport):
curl -s -H "Authorization: Bearer $CRON" "http://localhost:3001/api/cron/sync-live?dry=1"
# Zwykłe (strażnik: gdy nic nie live → note "no-live-window", zero zapisów):
curl -s -H "Authorization: Bearer $CRON" "http://localhost:3001/api/cron/sync-live"
```
Wynik dry-run (2026-06-21): **12/12 meczów zmapowanych, 0 nieznanych nazw**, wszystkie zakończone wyniki zgadzają się z bazą **co do gola** (Szkocja-Maroko 0:1, Brazylia-Haiti 3:0, Turcja-Paragwaj 0:1, Holandia-Szwecja 5:1, Niemcy-WybKS 2:1) → mapowanie + wyrównanie kolejności potwierdzone. `tsc --noEmit` = czysto.
> Uwaga: live update (zapis IN_PLAY) NIE był jeszcze przetestowany na realnym meczu na żywo (w momencie testu żaden nie był live). Logika prosta i zweryfikowana rozumowo, ale warto zerknąć przy pierwszym live.

## ZOSTAŁO DO ZROBIENIA (ETAP 2 — już prawie)

Cron live jest wpięty do `.github/workflows/sync-results.yml` (drugi krok woła `/api/cron/sync-live`,
`if: always()`, reużywa sekretów GitHub `CRON_SECRET`+`APP_URL` — te same, których używa sync-results,
więc NIC nie trzeba resetować). Endpoint `sync-live` jest już na prodzie.

**Jedyne, co zostało: commit + push** całości (UI tej sesji + lib/varzesh3.ts + app/api/cron/sync-live/
+ zmiana workflow + usunięcie wc26-ping). Uwaga: commituj WSZYSTKO razem — jeśli Vercel jest podpięty do
gita i push wyzwala redeploy, a UI byłoby niezacommitowane, to redeploy z gita cofnąłby zmiany UI na prodzie.

**Weryfikacja po pushu (definitywny test geo z Vercela):**
- GitHub → zakładka **Actions** → workflow „Sync match results + live" → **Run workflow** (workflow_dispatch).
- W logach kroku „Call sync-live endpoint" zobacz body: `v3Matches>0` = **Vercel dosięga Varzesh3** ✅;
  `note:"no-v3-data"` / błąd = geo-blok z Vercela (wtedy: region `fra1` w `vercel.json` i redeploy).
- Potem leci automatycznie co 5 min. Live w trakcie meczu pojawi się w sekcji „Na żywo" (LivePanel czyta IN_PLAY z bazy).

Kadencja: GitHub Actions ma minimum 5 min (i bywa opóźniony). Jeśli chcesz ~1–2 min — osobny workflow
z wewnętrzną pętlą (curl co ~60 s przez ~5 min, exit gdy `no-live-window`); kosztuje minuty Actions (ważne dla repo prywatnego).

### Minuta meczu w „Na żywo" — ZROBIONE (2026-06-21)
Varzesh3 daje `liveTime` (np. `"85'"`). Dodane: migracja `0012_live_minute.sql` (kolumna `matches.live_minute text`),
zapis w `syncLiveScores` (osobny best-effort update — przeżyje brak kolumny przed migracją), render w `LivePanel`
(`components/ResultsView.tsx`: `{m.live_minute || "LIVE"}`). **WYMAGA odpalenia migracji 0012 w Supabase SQL Editor**
(`alter table public.matches add column if not exists live_minute text;`) — do tego czasu badge pokazuje „LIVE".

## Ryzyka / uwagi
- **Nieoficjalne API** — format Varzesh3 może się zmienić bez ostrzeżenia. Moduł izolowany, ale wtedy live przestanie działać (fallback: ręczne).
- **8 drużyn** jeszcze nie pojawiło się w livescore w chwili budowy mapy (South Africa, Czech Republic, Bosnia, Switzerland, DR Congo, Colombia, Croatia, Panama) — zmapowane z `teams.json`, ale ich dokładny string z Varzesh3 nie został potwierdzony. Kod loguje nieznane nazwy do `summary.unmatched` — sprawdzić przy ich pierwszym meczu i w razie czego dopisać wariant do `FA_TO_EN`.
- **Lokalny `FOOTBALL_DATA_API_KEY` w `.env.local` jest nieważny** (FD zwraca „token is invalid"). Nie przeszkadza: dane realne pisze prod-cron na Vercelu do wspólnej bazy Supabase. sync-live jest od FD niezależny, więc działa lokalnie.

## Stan gita
Niezacommitowane: `lib/varzesh3.ts` (new), `app/api/cron/sync-live/route.ts` (new), `lib/footballdata.ts` (zmiana — alias DR Konga). Reszta zmian z tej sesji (tabele grup 2 kolumny, „Moje typy" scroll, „Typy kawalerów") też mogła nie być zacommitowana — sprawdzić `git status`.
