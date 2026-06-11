-- =====================================================================
-- Ręczne "Zatwierdź" typu króla strzelców — trwała blokada per gracz.
-- Uruchom w Supabase SQL Editor (po 0001–0007). Idempotentne.
-- Nie rusza punktacji meczów, RLS, blokad meczowych ani pucharów.
-- =====================================================================

alter table public.bonus_picks
  add column if not exists top_scorer_locked boolean not null default false;

-- set_bonus — kopia z 0002 + respektowanie blokady strzelca:
-- gdy gracz zatwierdził strzelca, kolejny zapis NIE zmienia top_scorer
-- (mistrz dalej edytowalny do startu turnieju).
create or replace function public.set_bonus(p_champion text, p_scorer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if now() >= public.tournament_start() - interval '60 seconds' then
    raise exception 'LOCKED';
  end if;

  insert into public.bonus_picks (player_id, champion, top_scorer, updated_at)
  values (v_uid, nullif(p_champion,''), nullif(p_scorer,''), now())
  on conflict (player_id)
  do update set
    champion   = excluded.champion,
    top_scorer = case when bonus_picks.top_scorer_locked
                      then bonus_picks.top_scorer
                      else excluded.top_scorer end,
    updated_at = now();
end;
$$;

-- Zatwierdzenie (trwała blokada) typu króla strzelców dla bieżącego gracza.
create or replace function public.lock_top_scorer()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if now() >= public.tournament_start() - interval '60 seconds' then
    raise exception 'LOCKED';
  end if;
  update public.bonus_picks
     set top_scorer_locked = true
   where player_id = v_uid and top_scorer is not null;
  if not found then
    raise exception 'NO_SCORER';
  end if;
end;
$$;

grant execute on function public.lock_top_scorer() to authenticated;

notify pgrst, 'reload schema';
