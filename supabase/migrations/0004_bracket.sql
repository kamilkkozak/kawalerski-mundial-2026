-- =====================================================================
-- Kawalerski Mundial 2026 — faza pucharowa (struktura slotów + obsada)
-- Dodaje kolumny opisujące sloty drabinki i RPC ręcznej obsady admina.
-- NIE rusza logiki blokady 60 s, punktacji ani RLS fazy grupowej.
-- =====================================================================

-- ---- kolumny drabinki ----------------------------------------------
alter table public.matches add column if not exists bracket_code text;       -- 'M73'..'M104'
alter table public.matches add column if not exists home_ref     text;       -- '2A' / '1E' / '3/ABCDF' / 'W73' / 'L101'
alter table public.matches add column if not exists away_ref     text;
-- Znacznik ręcznej obsady admina: auto-logika NIE nadpisuje zablokowanego slotu.
alter table public.matches add column if not exists home_locked  boolean not null default false;
alter table public.matches add column if not exists away_locked  boolean not null default false;

create unique index if not exists matches_bracket_code_idx
  on public.matches (bracket_code) where bracket_code is not null;

-- ---- RPC (admin): ręczna obsada slotu pary pucharowej ---------------
-- Ustawia drużynę w wybranej stronie meczu i blokuje slot (priorytet nad auto).
create or replace function public.admin_set_slot(
  p_match_id bigint,
  p_side     text,            -- 'home' | 'away'
  p_team     text,
  p_flag     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  if p_side not in ('home','away') then
    raise exception 'INVALID_SIDE';
  end if;
  if coalesce(trim(p_team),'') = '' then
    raise exception 'INVALID_TEAM';
  end if;

  if p_side = 'home' then
    update public.matches
       set team1 = p_team, flag1 = coalesce(p_flag, flag1), home_locked = true
     where id = p_match_id;
  else
    update public.matches
       set team2 = p_team, flag2 = coalesce(p_flag, flag2), away_locked = true
     where id = p_match_id;
  end if;
end;
$$;

-- ---- RPC (admin): wyczyszczenie slotu (powrót do auto/TBD) ----------
create or replace function public.admin_clear_slot(
  p_match_id bigint,
  p_side     text             -- 'home' | 'away'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  if p_side not in ('home','away') then
    raise exception 'INVALID_SIDE';
  end if;

  if p_side = 'home' then
    update public.matches set team1 = 'TBD', flag1 = null, home_locked = false where id = p_match_id;
  else
    update public.matches set team2 = 'TBD', flag2 = null, away_locked = false where id = p_match_id;
  end if;
end;
$$;
