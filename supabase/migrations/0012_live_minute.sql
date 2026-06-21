-- Minuta meczu na żywo (źródło: Varzesh3), pokazywana w sekcji "Na żywo".
-- Nullable tekst, np. "85'". Ustawiana przez /api/cron/sync-live tylko dla meczów live;
-- dla pozostałych pozostaje null/nieaktualna (LivePanel pokazuje tylko mecze w oknie live).
alter table public.matches add column if not exists live_minute text;
