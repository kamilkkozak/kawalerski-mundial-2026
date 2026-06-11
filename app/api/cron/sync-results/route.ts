import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { toPl, mapStatus, type FdMatch, type FdScorer } from "@/lib/footballdata";
import { progressionUpdates, isResolved, type Decided } from "@/lib/bracket";
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
  // Rozstrzygnięte mecze KO: kod -> { winner, loser } (po nazwie, uwzględnia karne).
  const decided: Decided = {};

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
    const att = typeof fm.attendance === "number" ? fm.attendance : null;
    const isKo = !!target.bracket_code;

    // Rozstrzygnięty mecz KO → zapamiętaj zwycięzcę/przegranego po NAZWIE (winner z API
    // uwzględnia dogrywkę/karne). Zbieramy też dla meczów już FINISHED (idempotentna progresja).
    if (isKo && status === "FINISHED") {
      const hp = toPl(fm.homeTeam?.name);
      const ap = toPl(fm.awayTeam?.name);
      const w = fm.score?.winner;
      let winner: string | null = null;
      let loser: string | null = null;
      if (w === "HOME_TEAM") { winner = hp; loser = ap; }
      else if (w === "AWAY_TEAM") { winner = ap; loser = hp; }
      if (winner) decided[target.bracket_code as string] = { winner, loser };
    }

    // Nie nadpisuj ręcznej korekty admina po zakończeniu meczu.
    // Wyjątek: frekwencja często pojawia się w API dopiero po meczu — uzupełnij ją,
    // gdy jeszcze pusta, nie ruszając wyniku/statusu.
    if (target.status === "FINISHED") {
      if (att != null && target.attendance == null) {
        await supabase.from("matches").update({ attendance: att }).eq("id", target.id);
        updated++;
      }
      continue;
    }

    // Mapowanie wyniku: dla par pucharowych po NAZWIE drużyny (nasza kolejność home_ref/away_ref
    // jest kanoniczna i może różnić się od kolejności home/away w API); dla grup — po pozycji.
    let sc1 = s1;
    let sc2 = s2;
    if (isKo && isResolved(target.team1, target.team2)) {
      const hp = toPl(fm.homeTeam?.name);
      if (hp && hp === target.team2) { sc1 = s2; sc2 = s1; }
    }

    const update: Record<string, unknown> = { status, score1: sc1, score2: sc2 };

    // Zapisz frekwencję, gdy API ją podało (nie zeruj istniejącej wartości).
    if (att != null) update.attendance = att;

    // Uzupełnij drużyny — TYLKO dla fazy grupowej. Obsadę par pucharowych ustala
    // progresja zwycięzców / panel admina (kanoniczna kolejność), nie kolejność API.
    let teamsChanged = false;
    if (!isKo) {
      const homePl = toPl(fm.homeTeam?.name);
      const awayPl = toPl(fm.awayTeam?.name);
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
    }

    const needsUpdate =
      target.status !== status ||
      target.score1 !== sc1 ||
      target.score2 !== sc2 ||
      teamsChanged ||
      (att != null && target.attendance !== att);
    if (needsUpdate) {
      await supabase.from("matches").update(update).eq("id", target.id);
      updated++;
    }
  }

  // Auto-progresja: zwycięzcy/przegrani wpadają do slotów W.../L... kolejnych rund.
  // Pomijamy sloty zablokowane ręcznie przez admina (priorytet obsady admina).
  let progressed = 0;
  const byCode = new Map(
    matches.filter((m) => m.bracket_code).map((m) => [m.bracket_code as string, m])
  );
  for (const u of progressionUpdates(decided)) {
    const tgt = byCode.get(u.code);
    if (!tgt) continue;
    const locked = u.side === "home" ? tgt.home_locked : tgt.away_locked;
    if (locked) continue;
    const cur = u.side === "home" ? tgt.team1 : tgt.team2;
    if (cur === u.team) continue; // już ustawione
    const upd =
      u.side === "home"
        ? { team1: u.team, flag1: FLAG[u.team] ?? null }
        : { team2: u.team, flag2: FLAG[u.team] ?? null };
    await supabase.from("matches").update(upd).eq("id", tgt.id);
    progressed++;
  }

  // ===================================================================
  // Klasyfikacja strzelców (/scorers) — ODPORNE: błąd/braki nie wywalają
  // synchronizacji wyników, tylko pomijamy sekcję i logujemy.
  // ===================================================================
  let scorersCount = 0;
  let bonusResolved: string | null = null;
  try {
    const sRes = await fetch("https://api.football-data.org/v4/competitions/WC/scorers", {
      headers: { "X-Auth-Token": apiKey },
      cache: "no-store",
    });
    if (!sRes.ok) {
      console.warn(`[scorers] pominięto — API ${sRes.status}`);
    } else {
      const sJson = (await sRes.json()) as { scorers?: FdScorer[] };
      const rows = (sJson.scorers ?? [])
        .map((sc, i) => {
          const name = sc.player?.name?.trim();
          if (!name) return null;
          const teamEn = sc.team?.name ?? null;
          return {
            player_name: name,
            rank: i + 1,
            team: teamEn ? toPl(teamEn) : null,
            team_en: teamEn,
            goals: typeof sc.goals === "number" ? sc.goals : 0,
            assists: typeof sc.assists === "number" ? sc.assists : null,
            updated_at: new Date().toISOString(),
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      if (rows.length > 0) {
        // Nadpisz czołówkę w całości (lista jest mała, ~top 10).
        await supabase.from("scorers").delete().neq("player_name", "");
        const { error: insErr } = await supabase.from("scorers").insert(rows);
        if (insErr) {
          console.warn(`[scorers] insert error: ${insErr.message}`);
        } else {
          scorersCount = rows.length;
          await supabase.from("settings").update({ scorers_synced_at: new Date().toISOString() }).eq("id", 1);
        }

        // -------- Auto-rozstrzyganie bonusu króla strzelców --------
        // Tylko PO FINALE i tylko jeśli admin nie ustawił wyniku ręcznie.
        try {
          const { data: finalRows } = await supabase.from("matches").select("status").eq("stage", "final");
          const finalDone = (finalRows ?? []).some((m: { status: string }) => m.status === "FINISHED");
          const { data: st } = await supabase
            .from("settings")
            .select("top_scorer_source")
            .eq("id", 1)
            .single();

          if (finalDone && st?.top_scorer_source !== "admin") {
            const maxGoals = Math.max(...rows.map((r) => r.goals));
            const leaders = rows.filter((r) => r.goals === maxGoals);
            if (leaders.length === 1) {
              await supabase
                .from("settings")
                .update({ top_scorer_result: leaders[0].player_name, top_scorer_source: "auto", top_scorer_review: false })
                .eq("id", 1);
              bonusResolved = leaders[0].player_name;
            } else {
              // Remis na 1. miejscu — nie zgadujemy, oddajemy decyzję adminowi.
              await supabase
                .from("settings")
                .update({ top_scorer_result: null, top_scorer_source: "auto", top_scorer_review: true })
                .eq("id", 1);
              bonusResolved = "REVIEW";
            }
          }
        } catch (e) {
          console.warn(`[scorers] auto-resolve pominięte: ${(e as Error).message}`);
        }
      }
    }
  } catch (e) {
    console.warn(`[scorers] sekcja pominięta: ${(e as Error).message}`);
  }

  return NextResponse.json({
    ok: true,
    fetched: fdMatches.length,
    linked,
    updated,
    progressed,
    scorers: scorersCount,
    bonusResolved,
    unmatched: unmatched.slice(0, 20),
    unmatchedCount: unmatched.length,
  });
}
