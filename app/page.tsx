import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import type { Match, Player, Prediction, BonusPick, Settings, StandingRow } from "@/lib/types";

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
    await supabase
      .from("players")
      .insert({ id: user.id, name: user.email?.split("@")[0] ?? "Gracz", email: user.email });
    ({ data: me } = await supabase.from("players").select("*").eq("id", user.id).single());
  }

  const [matchesRes, predsRes, myBonusRes, settingsRes, standingsRes] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff", { ascending: true }),
    supabase.from("predictions").select("*").eq("player_id", user.id),
    supabase.from("bonus_picks").select("*").eq("player_id", user.id).maybeSingle(),
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.rpc("get_standings"),
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

  return (
    <AppShell
      me={me as Player}
      matches={matches}
      initialPreds={myPreds}
      initialBonus={myBonus}
      settings={settings}
      initialStandings={standings}
    />
  );
}
