-- =====================================================================
-- Widok "Typy kawalerów" — RPC zwracający WYŁĄCZNIE fakt obstawienia.
-- Uruchom w Supabase SQL Editor (po 0001–0005).
--
-- Po co: przed blokadą meczu (now < kickoff-60s) polityka RLS predictions_select
-- NIE zwraca klientowi cudzych wierszy, więc cudze pred1/pred2 nie wyciekają.
-- Aby pokazać sam wskaźnik "obstawił / nie obstawił", potrzebujemy źródła
-- zwracającego TYLKO klucze istnienia (player_id, match_id) — bez wartości typu.
--
-- SECURITY DEFINER widzi wszystkie wiersze, ale eksponuje wyłącznie parę kluczy.
-- NIE zwraca pred1/pred2 -> nie da się podejrzeć cudzego typu w DevTools.
-- Istniejących polityk RLS (predictions/bonus) ani punktacji NIE rusza.
-- =====================================================================

create or replace function public.get_prediction_status()
returns table (player_id uuid, match_id bigint)
language sql
stable
security definer
set search_path = public
as $$
  select pr.player_id, pr.match_id
  from public.predictions pr;
$$;

grant execute on function public.get_prediction_status() to authenticated;
