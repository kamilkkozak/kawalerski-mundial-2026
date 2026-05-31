import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { toPl, mapStatus, type FdMatch } from "@/lib/footballdata";
import { TEAMS } from "@/lib/teams";
import type { Match } from "@/lib/types";

// Polska nazwa drużyny -> emoji flagi (do uzupełniania par pucharowych).
const FLAG: Record<string, string> = Object.fromEntries(TEAMS.map((t) => [t.name, t.flag]));

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Auto-pobieranie wyników z football-data.org. Wywoływane przez Vercel Cron co 5 min.
// Zabezpieczone nagłówkiem Authorization: Bearer <CRON_SECRET>.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing FOOTBALL_DATA_API_KEY" }, { status: 500 });
  }

  // Pobierz mecze MŚ (kod kompetencji "WC").
  const fdRes = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: { "X-Auth-Token": apiKey },
    cache: "no-store",
  });
  if (!fdRes.ok) {
    return NextResponse.json(
      { error: "football-data error", status: fdRes.status, body: await fdRes.text() },
      { status: 502 }
    );
  }
  const fd = (await fdRes.json()) as { matches?: FdMatch[] };
  const fdMatches = fd.matches ?? [];

  const supabase = createServiceClient();
  const { data: ours } = await supabase.from("matches").select("*");
  const matches = (ours ?? []) as Match[];

  const byExt = new Map<number, Match>();
  const byKickoff = new Map<string, Match[]>();
  for (const m of matches) {
    if (m.ext_id) byExt.set(m.ext_id, m);
    const k = new Date(m.kickoff).toISOString();
    const arr = byKickoff.get(k) ?? [];
    arr.push(m);
    byKickoff.set(k, arr);
  }

  const teamPair = (m: Match) => [m.team1, m.team2].sort().join("|");

  let updated = 0;
  let linked = 0;
  const unmatched: string[] = [];

  for (const fm of fdMatches) {
    let target = byExt.get(fm.id) ?? null;

    if (!target) {
      // Próba dopasowania po dokładnym czasie startu, a przy kolizji — po parze drużyn.
      const k = new Date(fm.utcDate).toISOString();
      const candidates = byKickoff.get(k) ?? [];
      if (candidates.length === 1) {
        target = candidates[0];
      } else if (candidates.length > 1) {
        const pair = [toPl(fm.homeTeam?.name), toPl(fm.awayTeam?.name)]
          .filter(Boolean)
          .sort()
          .join("|");
        target = candidates.find((c) => teamPair(c) === pair) ?? null;
      }
      if (target) {
        await supabase.from("matches").update({ ext_id: fm.id }).eq("id", target.id);
        linked++;
      }
    }

    if (!target) {
      unmatched.push(`${fm.homeTeam?.name} – ${fm.awayTeam?.name} (${fm.utcDate})`);
      continue;
    }

    const status = mapStatus(fm.status);
    const s1 = fm.score?.fullTime?.home ?? null;
    const s2 = fm.score?.fullTime?.away ?? null;

    // Nie nadpisuj ręcznej korekty admina po zakończeniu meczu.
    if (target.status === "FINISHED") continue;

    const update: Record<string, unknown> = { status, score1: s1, score2: s2 };

    // Uzupełnij drużyny pucharowe, gdy API już je zna (np. po fazie grupowej).
    const homePl = toPl(fm.homeTeam?.name);
    const awayPl = toPl(fm.awayTeam?.name);
    let teamsChanged = false;
    if (homePl && homePl !== target.team1) {
      update.team1 = homePl;
      update.flag1 = FLAG[homePl] ?? target.flag1;
      teamsChanged = true;
    }
    if (awayPl && awayPl !== target.team2) {
      update.team2 = awayPl;
      update.flag2 = FLAG[awayPl] ?? target.flag2;
      teamsChanged = true;
    }

    const needsUpdate =
      target.status !== status || target.score1 !== s1 || target.score2 !== s2 || teamsChanged;
    if (needsUpdate) {
      await supabase.from("matches").update(update).eq("id", target.id);
      updated++;
    }
  }

  return NextResponse.json({
    ok: true,
    fetched: fdMatches.length,
    linked,
    updated,
    unmatched: unmatched.slice(0, 20),
    unmatchedCount: unmatched.length,
  });
}
