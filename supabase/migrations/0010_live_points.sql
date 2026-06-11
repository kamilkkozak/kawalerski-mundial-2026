-- =====================================================================
-- Ranking liczy punkty także za wynik NA ŻYWO (nie tylko FINISHED).
-- Uruchom w Supabase SQL Editor (po 0001–0009). Idempotentne.
--
-- Zmiana wyłącznie w warunku liczenia meczu: punkty naliczamy, gdy mecz ma
-- wpisany wynik (score1/score2 != null) — niezależnie od statusu (IN_PLAY/
-- PAUSED/FINISHED). Mecz bez wyniku (TIMED) nadal nie daje punktów.
-- Reszta (blokady, RLS, bonus, dopasowanie strzelca) bez zmian.
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
        -- punkty gdy jest wynik (live lub końcowy); TIMED/bez wyniku -> null
        when m.score1 is not null and m.score2 is not null then
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

notify pgrst, 'reload schema';
