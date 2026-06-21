"use client";

import { useEffect, useMemo, useState } from "react";
import type { Match, PredMap, StandingRow } from "@/lib/types";
import { scoreMatch } from "@/lib/scoring";
import { I } from "./icons";
import Flag from "./Flag";
import Avatar from "./Avatar";
import RankEmblem from "./RankEmblem";

const PRIZES = [600, 250, 150];

export default function ResultsView({
  standings,
  meId,
  matches,
  preds,
  avatars,
  now,
}: {
  standings: StandingRow[];
  meId: string;
  matches: Match[];
  preds: PredMap;
  avatars: Record<string, string | null>;
  now: number;
}) {
  return (
    <div className="results-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Leaderboard standings={standings} meId={meId} avatars={avatars} />
        <MyBets matches={matches} preds={preds} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <LivePanel matches={matches} now={now} />
        <MatchHistory matches={matches} />
      </div>
    </div>
  );
}

// Okno "na żywo": od gwizdka do +130 min (margines na doliczony czas/przerwę).
const LIVE_WINDOW_MS = 130 * 60 * 1000;
function inLiveWindow(m: Match, now: number): boolean {
  const k = +new Date(m.kickoff); // kickoff jest w UTC (ISO z Z) — porównanie ms epoch jest strefowo bezpieczne
  return now >= k && now < k + LIVE_WINDOW_MS;
}
function isDoneWithScore(m: Match): boolean {
  return m.status === "FINISHED" && m.score1 != null && m.score2 != null;
}

function Leaderboard({ standings, meId, avatars }: { standings: StandingRow[]; meId: string; avatars: Record<string, string | null> }) {
  return (
    <div className="panel">
      <div className="panel-head">{I.trophy}<h3>Ranking</h3></div>
      {standings.map((p, i) => {
        const rank = i + 1;
        const podium = rank <= 3 ? `podium-${rank}` : "";
        return (
          <div key={p.player_id} className={`lb-row ${podium} ${p.player_id === meId ? "me" : ""}`}>
            <span className="lb-rank emblem"><RankEmblem rank={rank} size={58} /></span>
            <Avatar name={p.name} seed={p.player_id} size={36} avatarUrl={avatars[p.player_id]} />
            <span className="lb-name">
              {p.name}
              <small>{p.exact}× dokładny wynik · {Math.max(0, p.hits - p.exact)}× trafiony rezultat{p.bonus_points > 0 ? ` · +${p.bonus_points} bonus` : ""}</small>
            </span>
            {rank <= 3 ? <span className="lb-prize">{PRIZES[rank - 1]} zł</span> : <span />}
            <span className="lb-pts">{p.points}<small>pkt</small></span>
          </div>
        );
      })}
      {standings.length === 0 && <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>Brak graczy.</div>}
    </div>
  );
}

function LivePanel({ matches, now }: { matches: Match[]; now: number }) {
  // "live" zależy od czasu — liczymy je dopiero po zamontowaniu (anti hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // "Na żywo" = w oknie czasowym i jeszcze nierozstrzygnięty. Gdy admin ustawi
  // FINISHED z wynikiem, mecz natychmiast znika stąd i ląduje w Historii.
  const live = useMemo(
    () => (mounted ? matches.filter((m) => inLiveWindow(m, now) && !isDoneWithScore(m)).sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff)) : []),
    [matches, now, mounted]
  );

  return (
    <div className="panel">
      <div className="panel-head">
        <span style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "var(--bad)", animation: "pulse 1.2s infinite" }} />
        <h3>Na żywo</h3>
      </div>
      {live.length === 0 && (
        <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>Brak meczów na żywo.</div>
      )}
      {live.map((m) => (
        <div key={m.id} className="live-row" style={{ background: "color-mix(in srgb, var(--bad) 8%, transparent)" }}>
          {m.status === "FINISHED"
            ? <span className="lr-min ft">KONIEC</span>
            : <span className="lr-min"><span className="dot" />LIVE</span>}
          <Flag name={m.team1} />
          <span className="lr-team">{m.team1}</span>
          <span className="lr-score">{m.score1 ?? 0}:{m.score2 ?? 0}</span>
          <span className="lr-team away">{m.team2}</span>
          <Flag name={m.team2} />
        </div>
      ))}
    </div>
  );
}

// Historia rozegranych meczów (FINISHED z wynikiem), najnowsze u góry.
function MatchHistory({ matches }: { matches: Match[] }) {
  const done = useMemo(
    () =>
      matches
        .filter(isDoneWithScore)
        .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff)),
    [matches]
  );

  return (
    <div className="panel">
      <div className="panel-head">{I.cal}<h3>Historia meczów</h3></div>
      {done.length === 0 ? (
        <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>Brak rozegranych meczów.</div>
      ) : (
        <div style={{ maxHeight: "50vh", overflowY: "auto" }}>
          {done.map((m) => (
            <div key={m.id} className="live-row">
              <span className="lr-min ft" suppressHydrationWarning>{new Date(m.kickoff).toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit" })}</span>
              <Flag name={m.team1} />
              <span className="lr-team">{m.team1}</span>
              <span className="lr-score" style={{ color: "var(--muted)" }}>{m.score1}:{m.score2}</span>
              <span className="lr-team away">{m.team2}</span>
              <Flag name={m.team2} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyBets({ matches, preds }: { matches: Match[]; preds: PredMap }) {
  const rows = useMemo(
    () =>
      matches
        .filter((m) => (m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "PAUSED") && preds[m.id])
        .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff)),
    [matches, preds]
  );

  return (
    <div className="panel">
      <div className="panel-head">{I.star}<h3>Moje typy</h3></div>
      {rows.length === 0 ? (
        <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>Brak rozstrzygniętych typów.</div>
      ) : (
        <div className="mybets-scroll">
          <div className="mybets-row head"><span>Mecz</span><span className="mb-cell">Typ</span><span className="mb-cell">Wynik</span><span className="mb-pts">Pkt</span></div>
          {rows.map((m) => {
            const pred = preds[m.id];
            const finished = m.status === "FINISHED" && m.score1 != null && m.score2 != null;
            const pts = finished ? scoreMatch({ a: pred.pred1, b: pred.pred2 }, { a: m.score1, b: m.score2 }) : null;
            const cls = pts === 3 ? "p3" : pts === 1 ? "p1" : pts === 0 ? "p0" : "pending";
            return (
              <div key={m.id} className="mybets-row">
                <span className="mb-match"><Flag name={m.team1} /> {m.team1.slice(0, 3).toUpperCase()}–{m.team2.slice(0, 3).toUpperCase()} <Flag name={m.team2} /></span>
                <span className="mb-cell">{pred.pred1}:{pred.pred2}</span>
                <span className="mb-cell muted">{m.score1 != null ? `${m.score1}:${m.score2}` : "–"}</span>
                <span className={`mb-pts ${cls}`}>{finished ? `+${pts}` : "…"}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
