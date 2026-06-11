-- =====================================================================
-- Awatary graczy — kolumna players.avatar_url + bucket Storage 'avatars'
-- z politykami RLS. Uruchom w Supabase SQL Editor (po 0001–0004).
--
-- Model przechowywania:
--   * plik w Storage pod stałą ścieżką per user: avatars/{player_id}/avatar.webp
--     (folder = auth.uid()), więc upload z upsert NADPISUJE stary plik (zero śmieci).
--   * w bazie trzymamy TYLKO public URL/ścieżkę w players.avatar_url.
--   * gotowe awatary (public/avatars/*.svg) NIE lądują w Storage — avatar_url
--     wskazuje wtedy na statyczną ścieżkę w repo (np. '/avatars/ball-01.svg').
-- =====================================================================

-- ---- kolumna na URL/ścieżkę awatara ---------------------------------
alter table public.players add column if not exists avatar_url text;

-- ---- bucket 'avatars': publiczny odczyt + twarde limity serwerowe ----
-- file_size_limit 5 MB, whitelist MIME — wymuszane przez Storage niezależnie od UI.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,
  array['image/webp','image/jpeg','image/png']
)
on conflict (id) do update
  set public            = excluded.public,
      file_size_limit   = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---- polityki RLS na storage.objects --------------------------------
-- Odczyt: publiczny (awatary widoczne dla wszystkich).
-- Zapis/edycja/usuwanie: tylko własny folder {auth.uid()}/... — nigdy cudzy.
-- (storage.foldername(name))[1] = pierwszy segment ścieżki = player_id.

drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects
  for select to public
  using (bucket_id = 'avatars');

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- FALLBACK (gdyby SQL Editor nie pozwolił tworzyć polityk na storage.objects
-- — komunikat "must be owner of table objects"). Wtedy zrób to klikami:
--   1. Storage → New bucket → nazwa: avatars, Public bucket: ON,
--      File size limit: 5 MB, Allowed MIME types: image/webp, image/jpeg, image/png.
--   2. Storage → Policies → bucket avatars → New policy (dla storage.objects):
--      - SELECT: Target roles: public.  USING:  bucket_id = 'avatars'
--      - INSERT: Target roles: authenticated.  WITH CHECK:
--          bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
--      - UPDATE: jw. (USING i WITH CHECK identyczne jak INSERT WITH CHECK)
--      - DELETE: Target roles: authenticated.  USING: jw.
--   Kolumnę players.avatar_url i tak załóż przez SQL (pierwsza linia tego pliku).
-- =====================================================================
