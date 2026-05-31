-- =====================================================================
-- Funkcje (serwerowa walidacja blokady), trigger rejestracji, RLS.
-- =====================================================================

-- ---- helpers --------------------------------------------------------

-- Czy bieżący użytkownik jest adminem (SECURITY DEFINER -> omija RLS players,
-- więc bezpiecznie wołać w politykach players bez rekurencji).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.players where id = auth.uid()), false);
$$;

-- Start turnieju = pierwszy gwizdek (min kickoff). Blokada bonusów = start - 60 s.
create or replace function public.tournament_start()
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select min(kickoff) from public.matches;
$$;

-- ---- trigger: utwórz wiersz players po rejestracji w auth.users ------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.players (id, name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.bonus_picks (player_id) values (new.id)
  on conflict (player_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---- RPC: zapis typu z serwerową walidacją blokady 60 s -------------
create or replace function public.upsert_prediction(p_match_id bigint, p1 int, p2 int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_kick timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p1 is null or p2 is null or p1 < 0 or p2 < 0 or p1 > 99 or p2 > 99 then
    raise exception 'INVALID_SCORE';
  end if;

  select kickoff into v_kick from public.matches where id = p_match_id;
  if v_kick is null then
    raise exception 'MATCH_NOT_FOUND';
  end if;

  -- KLUCZOWA blokada serwerowa: po (kickoff - 60 s) zapis odrzucony.
  if now() >= v_kick - interval '60 seconds' then
    raise exception 'LOCKED';
  end if;

  insert into public.predictions (player_id, match_id, pred1, pred2)
  values (v_uid, p_match_id, p1, p2)
  on conflict (player_id, match_id)
  do update set pred1 = excluded.pred1, pred2 = excluded.pred2, updated_at = now();
end;
$$;

-- ---- RPC: zapis bonusów (blokada od startu turnieju) ----------------
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
  do update set champion = excluded.champion,
                top_scorer = excluded.top_scorer,
                updated_at = now();
end;
$$;

-- ---- RPC: tabela wyników (SECURITY DEFINER -> widzi wszystkie typy) --
create or replace function public.get_standings()
returns table (
  player_id    uuid,
  name         text,
  points       bigint,
  exact_hits   bigint,
  result_hits  bigint,
  bonus_points bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select s.champion_result, s.top_scorer_result from public.settings s where s.id = 1
  ),
  match_pts as (
    select
      pr.player_id,
      case
        when m.status = 'FINISHED' and m.score1 is not null and m.score2 is not null then
          case
            when pr.pred1 = m.score1 and pr.pred2 = m.score2 then 3
            when sign(pr.pred1 - pr.pred2) = sign(m.score1 - m.score2) then 1
            else 0
          end
        else null
      end as pts
    from public.predictions pr
    join public.matches m on m.id = pr.match_id
  ),
  per_player as (
    select
      mp.player_id,
      coalesce(sum(mp.pts), 0)                          as match_points,
      coalesce(sum((mp.pts = 3)::int), 0)               as exact_hits,
      coalesce(sum((mp.pts > 0)::int), 0)               as result_hits
    from match_pts mp
    where mp.pts is not null
    group by mp.player_id
  ),
  bonus as (
    select
      bp.player_id,
      ( case when (select champion_result from s) is not null
              and bp.champion = (select champion_result from s) then 10 else 0 end
      + case when (select top_scorer_result from s) is not null
              and lower(trim(bp.top_scorer)) = lower(trim((select top_scorer_result from s))) then 10 else 0 end
      ) as bonus_points
    from public.bonus_picks bp
  )
  select
    pl.id as player_id,
    pl.name,
    (coalesce(pp.match_points,0) + coalesce(b.bonus_points,0))::bigint as points,
    coalesce(pp.exact_hits,0)::bigint   as exact_hits,
    coalesce(pp.result_hits,0)::bigint  as result_hits,
    coalesce(b.bonus_points,0)::bigint  as bonus_points
  from public.players pl
  left join per_player pp on pp.player_id = pl.id
  left join bonus b on b.player_id = pl.id
  order by points desc, exact_hits desc, pl.name asc;
$$;

-- ---- RPC (admin): ręczna korekta wyniku meczu -----------------------
create or replace function public.admin_set_result(p_match_id bigint, s1 int, s2 int, p_status text default 'FINISHED')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  update public.matches
     set score1 = s1, score2 = s2, status = p_status
   where id = p_match_id;
end;
$$;

-- ---- RPC (admin): wynik bonusów -------------------------------------
create or replace function public.admin_set_bonus_result(p_champion text, p_scorer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'NOT_ADMIN';
  end if;
  update public.settings
     set champion_result = nullif(p_champion,''),
         top_scorer_result = nullif(p_scorer,''),
         settled_at = now()
   where id = 1;
end;
$$;

-- =====================================================================
-- RLS
-- =====================================================================
alter table public.players      enable row level security;
alter table public.matches      enable row level security;
alter table public.predictions  enable row level security;
alter table public.bonus_picks  enable row level security;
alter table public.settings     enable row level security;

-- players: każdy zalogowany widzi listę graczy; edycja tylko własnego wiersza.
drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to authenticated using (true);

drop policy if exists players_update_self on public.players;
create policy players_update_self on public.players
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- matches: odczyt dla zalogowanych; zapis tylko admin (cron używa service_role -> omija RLS).
drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches
  for select to authenticated using (true);

drop policy if exists matches_admin_write on public.matches;
create policy matches_admin_write on public.matches
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- predictions: własne zawsze; cudze dopiero po blokadzie meczu (now >= kickoff - 60s).
-- Zapis wyłącznie przez RPC upsert_prediction (brak polityk INSERT/UPDATE).
drop policy if exists predictions_select on public.predictions;
create policy predictions_select on public.predictions
  for select to authenticated using (
    player_id = auth.uid()
    or exists (
      select 1 from public.matches m
      where m.id = predictions.match_id
        and now() >= m.kickoff - interval '60 seconds'
    )
  );

-- bonus_picks: własne zawsze; cudze dopiero po starcie turnieju.
-- Zapis wyłącznie przez RPC set_bonus.
drop policy if exists bonus_select on public.bonus_picks;
create policy bonus_select on public.bonus_picks
  for select to authenticated using (
    player_id = auth.uid()
    or now() >= public.tournament_start() - interval '60 seconds'
  );

-- settings: odczyt dla zalogowanych; zapis przez RPC admin_* (SECURITY DEFINER).
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated using (true);
