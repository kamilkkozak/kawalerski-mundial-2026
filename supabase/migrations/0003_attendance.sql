-- =====================================================================
-- Kawalerski Mundial 2026 — frekwencja (attendance)
-- Dodaje kolumnę matches.attendance (int, null) uzupełnianą po meczu
-- z football-data.org przez cron sync-results. Nie rusza RLS ani funkcji.
-- =====================================================================

alter table public.matches add column if not exists attendance int;
