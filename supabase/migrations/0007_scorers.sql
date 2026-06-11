-- =====================================================================
-- Klasyfikacja króla strzelców (z /v4/competitions/WC/scorers) +
-- elastyczne dopasowanie nazwiska do bonusu + auto-rozstrzyganie po finale.
-- Uruchom w Supabase SQL Editor (po 0001–0006). Idempotentne.
--
-- NIE rusza punktacji meczów (3/1/0), blokad, RLS typów, fazy pucharowej
-- ani auto-obsady par. Jedyna zmiana w get_standings to elastyczne porównanie
-- nazwiska strzelca (sam bonus +10, mechanizm bez zmian).
-- =====================================================================

-- ---- tabela czołówki strzelców (nadpisywana przez cron) -------------
create table if not exists public.scorers (
  player_name text primary key,
  rank        int,
  team        text,        -- polska nazwa (zmapowana) lub oryginał
  team_en     text,        -- oryginał z API (do mapowania flagi)
  goals       int not null default 0,
  assists     int,
  updated_at  timestamptz not null default now()
);

alter table public.scorers enable row level security;
drop policy if exists scorers_select on public.scorers;
create policy scorers_select on public.scorers
  for select to authenticated using (true);
-- Zapis tylko przez cron/service_role (omija RLS) — brak polityk write.

-- ---- settings: metadane synchronizacji + źródło/rewizja bonusu ------
alter table public.settings add column if not exists scorers_synced_at  timestamptz;
alter table public.settings add column if not exists top_scorer_source  text;     -- 'auto' | 'admin' | null
alter table public.settings add column if not exists top_scorer_review  boolean not null default false;

-- =====================================================================
-- Dopasowanie nazwisk (diakrytyki + nazwisko/pełne imię)
-- =====================================================================

-- Normalizacja: lower + trim + usunięcie diakrytyk do ASCII.
create or replace function public.norm_name(s text)
returns text
language sql
immutable
as $$
  select translate(
    lower(trim(coalesce(s, ''))),
    'ąćęłńóśźżàâäãéèêëíïîòôöõúùûüñçýščž',
    'acelnoszzaaaaeeeeiiioooouuuuncyscz'
  );
$$;

-- Trafienie, gdy typ gracza = pełne nazwisko z API LUB samo nazwisko (ostatni wyraz).
create or replace function public.scorer_name_match(guess text, full_name text)
returns boolean
language plpgsql
immutable
as $$
declare
  ng    text := public.norm_name(guess);
  nf    text := public.norm_name(full_name);
  parts text[];
begin
  if ng = '' or nf = '' then
    return false;
  end if;
  if ng = nf then
    return true;
  end if;
  parts := regexp_split_to_array(nf, '\s+');
  return ng = parts[array_upper(parts, 1)]; -- ostatni wyraz = nazwisko
end;
$$;

-- =====================================================================
-- get_standings — KOPIA 1:1 z 0002, zmieniona TYLKO linia bonusu strzelca
-- (elastyczne dopasowanie zamiast exact-equality). Reszta bez zmian.
-- =====================================================================
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
              and bp.top_scorer is not null
              and public.scorer_name_match(bp.top_scorer, (select top_scorer_result from s)) then 10 else 0 end
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

-- =====================================================================
-- admin_set_bonus_result — KOPIA z 0002 + zapis źródła (admin = priorytet).
-- =====================================================================
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
     set champion_result   = nullif(p_champion,''),
         top_scorer_result = nullif(p_scorer,''),
         -- ręczne podanie strzelca = źródło 'admin' (auto już tego nie nadpisze);
         -- puste = null (auto może przejąć po finale).
         top_scorer_source = case when nullif(p_scorer,'') is not null then 'admin' else null end,
         top_scorer_review = false,
         settled_at = now()
   where id = 1;
end;
$$;

-- Odśwież cache PostgREST, żeby nowe funkcje/kolumny były od razu widoczne.
notify pgrst, 'reload schema';
