"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Czyta statystyki meczu z bazy (match_stats) — zero zapytań do API-Football.
// Lazy: pobiera dopiero po rozwinięciu karty; cache w stanie komponentu.

type XiPlayer = { n: number | null; name: string | null; pos: string | null };
type SideLineup = { formation: string | null; coach: string | null; xi: XiPlayer[] } | null;
type MatchEvent = { minute: string | number; team: string | null; player: string | null; assist: string | null; type: string | null; detail: string | null };

type StatsRow = {
  available: boolean;
  possession_home: number | null; possession_away: number | null;
  shots_home: number | null; shots_away: number | null;
  shots_on_home: number | null; shots_on_away: number | null;
  corners_home: number | null; corners_away: number | null;
  fouls_home: number | null; fouls_away: number | null;
  yellow_home: number | null; yellow_away: number | null;
  red_home: number | null; red_away: number | null;
  lineups: { team1: SideLineup; team2: SideLineup } | null;
  events: MatchEvent[] | null;
};

export default function MatchStatsPanel({ matchId, team1, team2 }: { matchId: number; team1: string; team2: string }) {
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [row, setRow] = useState<StatsRow | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.from("match_stats").select("*").eq("match_id", matchId).maybeSingle();
        if (alive) { setRow((data as StatsRow) ?? null); setState("ready"); }
      } catch {
        if (alive) { setRow(null); setState("ready"); }
      }
    })();
    return () => { alive = false; };
  }, [matchId]);

  if (state === "loading") {
    return <div className="ms-panel"><div className="ms-empty">Ładowanie statystyk…</div></div>;
  }

  if (!row || !row.available) {
    return <div className="ms-panel"><div className="ms-empty">Statystyki niedostępne dla tego meczu.</div></div>;
  }

  const goals = (row.events ?? []).filter((e) => e.type === "Goal" && e.detail !== "Missed Penalty");

  return (
    <div className="ms-panel">
      <div className="ms-teams"><span>{team1}</span><span>{team2}</span></div>

      <StatRow label="Posiadanie %" h={row.possession_home} a={row.possession_away} pct={row.possession_home ?? undefined} />
      <StatRow label="Strzały" h={row.shots_home} a={row.shots_away} />
      <StatRow label="Strzały celne" h={row.shots_on_home} a={row.shots_on_away} />
      <StatRow label="Rożne" h={row.corners_home} a={row.corners_away} />
      <StatRow label="Faule" h={row.fouls_home} a={row.fouls_away} />
      <StatRow label="Żółte kartki" h={row.yellow_home} a={row.yellow_away} tone="yellow" />
      <StatRow label="Czerwone kartki" h={row.red_home} a={row.red_away} tone="red" />

      {goals.length > 0 && (
        <div className="ms-section">
          <div className="ms-sec-head">Bramki</div>
          <ul className="ms-goals">
            {goals.map((g, i) => (
              <li key={i}><b>{g.minute}'</b> {g.player ?? "—"}<span className="ms-goal-team">{g.team}</span></li>
            ))}
          </ul>
        </div>
      )}

      {row.lineups?.team1?.xi?.length ? (
        <div className="ms-section ms-lineups">
          <SideXI title={team1} side={row.lineups.team1} />
          <SideXI title={team2} side={row.lineups.team2} />
        </div>
      ) : null}
    </div>
  );
}

function StatRow({ label, h, a, pct, tone }: { label: string; h: number | null; a: number | null; pct?: number; tone?: "yellow" | "red" }) {
  const total = (h ?? 0) + (a ?? 0);
  const left = pct != null ? Math.max(0, Math.min(100, pct)) : total > 0 ? Math.round(((h ?? 0) / total) * 100) : 50;
  return (
    <div className="ms-row">
      <span className={`ms-v ${tone ?? ""}`}>{h ?? "–"}</span>
      <span className="ms-mid">
        <span className="ms-label">{label}</span>
        <span className="ms-bar">
          <span className={`ms-bar-h ${tone ?? ""}`} style={{ width: `${left}%` }} />
          <span className={`ms-bar-a ${tone ?? ""}`} style={{ width: `${100 - left}%` }} />
        </span>
      </span>
      <span className={`ms-v ${tone ?? ""}`}>{a ?? "–"}</span>
    </div>
  );
}

function SideXI({ title, side }: { title: string; side: SideLineup }) {
  if (!side) return <div className="ms-xi"><div className="ms-xi-head">{title}</div></div>;
  return (
    <div className="ms-xi">
      <div className="ms-xi-head">{title}{side.formation ? <small> · {side.formation}</small> : null}</div>
      <ol className="ms-xi-list">
        {side.xi.map((p, i) => (
          <li key={i}><span className="ms-xi-n">{p.n ?? ""}</span>{p.name ?? "—"}</li>
        ))}
      </ol>
    </div>
  );
}
