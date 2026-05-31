"use client";

import { useMemo } from "react";
import type { Match, PredMap, StandingRow } from "@/lib/types";
import { scoreMatch } from "@/lib/scoring";
import { fmtTime } from "@/lib/ui";
import { I } from "./icons";
import Flag from "./Flag";
import Avatar from "./Avatar";

const PRIZES = [250, 125, 75];

export default function ResultsView({
  standings,
  meId,
  matches,
  preds,
}: {
  standings: StandingRow[];
  meId: string;
  matches: Match[];
  preds: PredMap;
}) {
  return (
    <div className="results-grid">
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <Leaderboard standings={standings} meId={meId} />
        <MyBets matches={matches} preds={preds} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <LivePanel matches={matches} />
        <PotPanel standings={standings} />
      </div>
    </div>
  );
}

function Leaderboard({ standings, meId }: { standings: StandingRow[]; meId: string }) {
  return (
    <div className="panel">
      <div className="panel-head">{I.trophy}<h3>Klasyfikacja generalna</h3><span className="ph-meta">na żywo</span></div>
      {standings.map((p, i) => {
        const rank = i + 1;
        const podium = rank <= 3 ? `podium-${rank}` : "";
        return (
          <div key={p.player_id} className={`lb-row ${podium} ${p.player_id === meId ? "me" : ""}`}>
            <span className="lb-rank">{rank}</span>
            <Avatar name={p.name} seed={p.player_id} size={36} />
            <span className="lb-name">
              {p.name}
              <small>{p.exact}× trafiony wynik{p.bonus_points > 0 ? ` · +${p.bonus_points} bonus` : ""}</small>
            </span>
            <span className="lb-pts">{p.points}<small>pkt</small></span>
          </div>
        );
      })}
      {standings.length === 0 && <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>Brak graczy.</div>}
    </div>
  );
}

function PotPanel({ standings }: { standings: StandingRow[] }) {
  return (
    <div className="panel">
      <div className="panel-head">{I.cup}<h3>Pula nagród</h3><span className="ph-meta">wpisowe 50 zł</span></div>
      <div style={{ padding: "6px 0" }}>
        {PRIZES.map((zl, i) => {
          const who = standings[i];
          return (
            <div key={i} className={`lb-row podium-${i + 1}`}>
              <span className="lb-rank">{i + 1}</span>
              {who ? <Avatar name={who.name} seed={who.player_id} size={34} /> : <span className="avatar" style={{ width: 34, height: 34, background: "var(--surface-3)" }} />}
              <span className="lb-name">{who ? who.name : "—"}<small>obecny lider miejsca</small></span>
              <span className="lb-prize" style={{ fontSize: 13, padding: "4px 11px" }}>{zl} zł</span>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)", fontSize: 11.5, color: "var(--muted)", lineHeight: 1.6 }}>
        Nagrody: <b style={{ color: "var(--text)" }}>1. 250 zł · 2. 125 zł · 3. 75 zł</b>. Bonus końcowy: +10 pkt za mistrza i +10 pkt za króla strzelców. Kasę rozliczacie między sobą.
      </div>
    </div>
  );
}

function LivePanel({ matches }: { matches: Match[] }) {
  const { live, recent } = useMemo(() => {
    const live = matches.filter((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
    const recent = matches
      .filter((m) => m.status === "FINISHED" && m.score1 != null)
      .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))
      .slice(0, 5);
    return { live, recent };
  }, [matches]);

  return (
    <div className="panel">
      <div className="panel-head">
        <span style={{ display: "inline-flex", width: 10, height: 10, borderRadius: "50%", background: "var(--bad)", animation: "pulse 1.2s infinite" }} />
        <h3>Na żywo</h3>
        <span className="ph-meta">auto-sync co 5 min</span>
      </div>
      {live.length === 0 && recent.length === 0 && (
        <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>Brak meczów na żywo ani rozegranych.</div>
      )}
      {live.map((m) => (
        <div key={m.id} className="live-row" style={{ background: "color-mix(in srgb, var(--bad) 8%, transparent)" }}>
          <span className="lr-min"><span className="dot" />LIVE</span>
          <Flag name={m.team1} />
          <span className="lr-team">{m.team1}</span>
          <span className="lr-score">{m.score1 ?? 0}:{m.score2 ?? 0}</span>
          <span className="lr-team away">{m.team2}</span>
          <Flag name={m.team2} />
        </div>
      ))}
      {recent.map((m) => (
        <div key={m.id} className="live-row">
          <span className="lr-min ft">KONIEC</span>
          <Flag name={m.team1} />
          <span className="lr-team">{m.team1}</span>
          <span className="lr-score" style={{ color: "var(--muted)" }}>{m.score1}:{m.score2}</span>
          <span className="lr-team away">{m.team2}</span>
          <Flag name={m.team2} />
        </div>
      ))}
    </div>
  );
}

function MyBets({ matches, preds }: { matches: Match[]; preds: PredMap }) {
  const rows = useMemo(
    () =>
      matches
        .filter((m) => (m.status === "FINISHED" || m.status === "IN_PLAY" || m.status === "PAUSED") && preds[m.id])
        .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))
        .slice(0, 10),
    [matches, preds]
  );

  return (
    <div className="panel">
      <div className="panel-head">{I.star}<h3>Moje typy</h3></div>
      <div className="mybets-row head"><span>Mecz</span><span className="mb-cell">Typ</span><span className="mb-cell">Wynik</span><span className="mb-pts">Pkt</span></div>
      {rows.length === 0 && <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>Brak rozstrzygniętych typów.</div>}
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
  );
}
