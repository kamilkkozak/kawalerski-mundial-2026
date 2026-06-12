import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import type { Match, Player, Prediction, BonusPick, Settings, StandingRow, Scorer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Wiersz gracza (tworzony triggerem przy rejestracji; fallback gdyby go brakło).
  let { data: me } = await supabase.from("players").select("*").eq("id", user.id).single();
  if (!me) {
    // Dotwórz brakujący wiersz przez service_role (RLS nie ma polityki INSERT na players).
    // Self-healing dla kont auth bez wiersza w players (np. po czyszczeniu danych).
    const admin = createServiceClient();
    const name =
      (user.user_metadata?.name as string | undefined)?.trim() ||
      user.email?.split("@")[0] ||
      "Gracz";
    await admin.from("players").upsert({ id: user.id, name, email: user.email }, { onConflict: "id" });
    await admin.from("bonus_picks").upsert({ player_id: user.id }, { onConflict: "player_id" });
    ({ data: me } = await supabase.from("players").select("*").eq("id", user.id).single());
  }

  const [matchesRes, predsRes, myBonusRes, settingsRes, standingsRes, playersRes, statusRes, visiblePredsRes, scorersRes, allBonusRes] =
    await Promise.all([
      supabase.from("matches").select("*").order("kickoff", { ascending: true }),
      supabase.from("predictions").select("*").eq("player_id", user.id),
      supabase.from("bonus_picks").select("*").eq("player_id", user.id).maybeSingle(),
      supabase.from("settings").select("*").eq("id", 1).single(),
      supabase.rpc("get_standings"),
      supabase.from("players").select("id, name, avatar_url"),
      // Tylko fakt obstawienia (player_id, match_id) — bez wartości typu (RPC presence-only).
      supabase.rpc("get_prediction_status"),
      // Widoczne wartości typów: RLS oddaje moje zawsze + cudze tylko po blokadzie meczu.
      supabase.from("predictions").select("player_id, match_id, pred1, pred2"),
      supabase.from("scorers").select("*").order("rank", { ascending: true }),
      // Bonus picks wszystkich graczy — RLS ujawnia po starcie turnieju.
      supabase.from("bonus_picks").select("player_id, champion, champion_locked, top_scorer, top_scorer_locked"),
    ]);

  const matches = (matchesRes.data ?? []) as Match[];
  const myPreds = (predsRes.data ?? []) as Prediction[];
  const myBonus = (myBonusRes.data ?? null) as BonusPick | null;
  const settings = (settingsRes.data ?? null) as Settings | null;
  const standings = ((standingsRes.data ?? []) as any[]).map((r) => ({
    player_id: r.player_id,
    name: r.name,
    points: Number(r.points),
    exact: Number(r.exact_hits),
    hits: Number(r.result_hits),
    bonus_points: Number(r.bonus_points),
  })) as StandingRow[];

  // Lista graczy + mapa awatarów (do rankingu/puli/typów; logiki punktacji nie ruszamy).
  const players = ((playersRes.data ?? []) as { id: string; name: string; avatar_url: string | null }[]);
  const avatars: Record<string, string | null> = {};
  for (const r of players) avatars[r.id] = r.avatar_url;

  const scorers = (scorersRes.data ?? []) as Scorer[];
  const allBonusPicks = (allBonusRes.data ?? []) as { player_id: string; champion: string | null; champion_locked: boolean; top_scorer: string | null; top_scorer_locked: boolean }[];
  const betStatus = (statusRes.data ?? []) as { player_id: string; match_id: number }[];
  const visiblePreds = (visiblePredsRes.data ?? []) as {
    player_id: string;
    match_id: number;
    pred1: number;
    pred2: number;
  }[];

  return (
    <AppShell
      me={me as Player}
      matches={matches}
      initialPreds={myPreds}
      initialBonus={myBonus}
      settings={settings}
      initialStandings={standings}
      initialAvatars={avatars}
      players={players}
      initialBetStatus={betStatus}
      initialVisiblePreds={visiblePreds}
      initialScorers={scorers}
      initialAllBonusPicks={allBonusPicks}
    />
  );
}
