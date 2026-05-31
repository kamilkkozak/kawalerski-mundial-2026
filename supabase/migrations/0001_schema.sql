-- =====================================================================
-- Kawalerski Mundial 2026 — schemat bazy
-- Uruchom w Supabase SQL Editor (kolejno 0001, 0002, potem seed_*.sql).
-- =====================================================================

-- ---- players (1:1 z auth.users) ------------------------------------
create table if not exists public.players (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---- matches --------------------------------------------------------
create table if not exists public.matches (
  id           bigint generated always as identity primary key,
  ext_id       bigint unique,                 -- id z football-data.org (do auto-sync)
  stage        text not null default 'group'
               check (stage in ('group','r32','r16','qf','sf','third','final')),
  group_label  text,                          -- 'A'..'L' dla fazy grupowej
  kickoff      timestamptz not null,
  team1        text not null,
  team2        text not null,
  flag1        text,
  flag2        text,
  venue        text,
  score1       int,
  score2       int,
  status       text not null default 'SCHEDULED'
               check (status in ('SCHEDULED','TIMED','IN_PLAY','PAUSED','FINISHED'))
);
create index if not exists matches_kickoff_idx on public.matches (kickoff);

-- ---- predictions ----------------------------------------------------
create table if not exists public.predictions (
  player_id   uuid not null references public.players(id) on delete cascade,
  match_id    bigint not null references public.matches(id) on delete cascade,
  pred1       int not null check (pred1 >= 0 and pred1 <= 99),
  pred2       int not null check (pred2 >= 0 and pred2 <= 99),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (player_id, match_id)
);
create index if not exists predictions_match_idx on public.predictions (match_id);

-- ---- bonus_picks (mistrz + król strzelców) -------------------------
create table if not exists public.bonus_picks (
  player_id   uuid primary key references public.players(id) on delete cascade,
  champion    text,
  top_scorer  text,
  updated_at  timestamptz not null default now()
);

-- ---- settings (jeden wiersz, id = 1) -------------------------------
create table if not exists public.settings (
  id                 int primary key default 1 check (id = 1),
  champion_result    text,
  top_scorer_result  text,
  settled_at         timestamptz
);
insert into public.settings (id) values (1) on conflict (id) do nothing;
