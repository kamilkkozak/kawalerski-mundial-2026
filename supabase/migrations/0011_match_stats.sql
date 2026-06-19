-- =====================================================================
-- Kawalerski Mundial 2026 — moduł statystyk meczu (API-Football)
-- Uruchom w Supabase SQL Editor po 0001–0010. Idempotentne.
--
-- IZOLACJA: nie rusza punktacji, blokad, RLS typów/bonusów, fazy pucharowej
-- ani synchronizacji football-data.org. Dodaje wyłącznie:
--   • matches.apif_fixture_id  — mapowanie do fixture w API-Football
--   • public.match_stats       — statystyki/składy/zdarzenia (read-only dla graczy)
--   • public.apif_quota        — twardy licznik zużycia limitu API/dobę (tylko cron)
-- =====================================================================

-- Mapowanie naszego meczu -> fixture id w API-Football (ustawiane przez cron).
alter table public.matches add column if not exists apif_fixture_id bigint;

-- Jeden wiersz na mecz: statystyki + składy + zdarzenia + bookkeeping pobierania.
create table if not exists public.match_stats (
  match_id          bigint primary key references public.matches(id) on delete cascade,
  available         boolean not null default false,  -- czy API podało statystyki
  possession_home   int, possession_away   int,      -- %
  shots_home        int, shots_away        int,
  shots_on_home     int, shots_on_away     int,
  corners_home      int, corners_away      int,
  fouls_home        int, fouls_away        int,
  yellow_home       int, yellow_away       int,
  red_home          int, red_away          int,
  lineups           jsonb,                            -- XI obu drużyn (null gdy brak)
  events            jsonb,                            -- gole/kartki (null gdy brak)
  raw               jsonb,                            -- pełny payload statistics (zapas)
  attempts          int not null default 0,           -- liczba prób pobrania (limit retry)
  last_attempt_at   timestamptz,
  fetched_at        timestamptz
);

alter table public.match_stats enable row level security;
drop policy if exists match_stats_select on public.match_stats;
create policy match_stats_select on public.match_stats
  for select to authenticated using (true);
-- Zapis tylko service_role (cron) — brak polityk write.

-- Licznik zużycia limitu API-Football (twardy guard). Reset naturalny: nowy wiersz/dzień (UTC).
create table if not exists public.apif_quota (
  day    date primary key,
  count  int not null default 0
);
alter table public.apif_quota enable row level security; -- brak polityk = wyłącznie service_role

-- Odśwież cache PostgREST, żeby nowe kolumny/tabele były od razu widoczne.
notify pgrst, 'reload schema';
