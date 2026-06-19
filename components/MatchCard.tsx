"use client";

import { useState } from "react";
import type { Match } from "@/lib/types";
import { isLocked, scoreMatch } from "@/lib/scoring";
import { fmtTime, fmtDateShort, fmtDateTimeSafe } from "@/lib/ui";
import { venueInfo } from "@/lib/venues";
import { I } from "./icons";
import Flag from "./Flag";
import MatchStatsPanel from "./MatchStatsPanel";

// Statystyki meczu (API-Football) — UI ukryte do czasu skonfigurowania API.
// Włącz ustawiając NEXT_PUBLIC_STATS_ENABLED=1 (lokalnie w .env.local, na prod w Vercel).
const STATS_UI = process.env.NEXT_PUBLIC_STATS_ENABLED === "1";


export default function MatchCard({
  match,
  pred,
  now,
  onOpen,
}: {
  match: Match;
  pred?: { pred1: number; pred2: number };
  now: number;
  onOpen: () => void;
}) {
  const [showStats, setShowStats] = useState(false);
  const hasResult = match.score1 != null && match.score2 != null && match.status === "FINISHED";
  const live = match.status === "IN_PLAY" || match.status === "PAUSED";
  const locked = isLocked(match.kickoff, now);
  const pts = hasResult && pred ? scoreMatch({ a: pred.pred1, b: pred.pred2 }, { a: match.score1, b: match.score2 }) : null;

  let stateCls = "";
  if (live) stateCls = "live";
  else if (hasResult) stateCls = "done";
  else if (locked) stateCls = "locked";

  const clickable = !locked || hasResult || live;
  const v = venueInfo(match.venue);

  return (
    <div className={`match ${stateCls}`} onClick={() => clickable && onOpen()} style={{ cursor: clickable ? "pointer" : "default" }}>
      <div className="match-side home">
        <Flag name={match.team1} />
        <span className="tn">{match.team1}</span>
      </div>

      <div className="match-center">
        {live ? (
          <>
            <div className="match-score"><span style={{ color: "var(--bad)" }}>{match.score1 ?? 0}</span><span className="sep">:</span><span style={{ color: "var(--bad)" }}>{match.score2 ?? 0}</span></div>
            {fmtDateTimeSafe(match.updated_at) && <span className="match-update-time">Aktualizacja: {fmtDateTimeSafe(match.updated_at)}.</span>}
            {pred ? <span className="match-pred-tag has">Twój typ {pred.pred1}:{pred.pred2}</span> : <span className="match-pred-tag">brak typu</span>}
          </>
        ) : hasResult ? (
          <>
            <div className="match-when">{fmtDateShort(match.kickoff)} · {fmtTime(match.kickoff)} · koniec</div>
            <div className="match-score">{match.score1}<span className="sep">:</span>{match.score2}</div>
            {pts != null ? (
              <span className={`match-pred-tag ${pts === 3 ? "pts-3" : pts === 1 ? "pts-1" : "pts-0"}`}>{pred!.pred1}:{pred!.pred2} · +{pts} pkt</span>
            ) : (
              <span className="match-pred-tag">brak typu</span>
            )}
          </>
        ) : (
          <>
            <div className="match-when">{fmtDateShort(match.kickoff)} · {fmtTime(match.kickoff)}</div>
            <div className="match-score empty">
              {pred ? <span style={{ color: "var(--accent)" }}>{pred.pred1}<span className="sep">:</span>{pred.pred2}</span> : <span>–<span className="sep">:</span>–</span>}
            </div>
            {locked ? (
              pred ? <span className="match-pred-tag has" style={{ opacity: 0.7 }}>typ zablokowany</span> : <span className="match-pred-tag">typ przepadł</span>
            ) : (
              pred ? <span className="match-pred-tag has">{I.check} wytypowane</span> : <span className="match-pred-tag" style={{ color: "var(--accent)" }}>+ typuj</span>
            )}
          </>
        )}
      </div>

      <div className="match-side away">
        <Flag name={match.team2} />
        <span className="tn">{match.team2}</span>
      </div>

      {v && (
        <div className="match-venue">
          <span className="mv-place">
            {I.pin}
            <span className="mv-stadium">{v.stadium}</span>
            <span className="mv-sep">·</span>
            <span className="mv-city">{v.city}</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="mv-flag"
              src={`https://flagcdn.com/${v.cc}.svg`}
              alt={v.country}
              title={v.country}
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
            />
          </span>
          <span className="mv-meta">
            {v.capacity.toLocaleString("pl-PL")} miejsc
            {hasResult && match.attendance != null && (
              <span className="mv-att"> · {I.people} {match.attendance.toLocaleString("pl-PL")}</span>
            )}
          </span>
        </div>
      )}

      {hasResult && STATS_UI && (
        <div className="match-stats-wrap" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`match-stats-toggle ${showStats ? "open" : ""}`}
            onClick={() => setShowStats((s) => !s)}
            aria-expanded={showStats}
          >
            {I.chart}<span>Statystyki meczu</span><span className="mst-chev">{showStats ? "▲" : "▼"}</span>
          </button>
          {showStats && <MatchStatsPanel matchId={match.id} team1={match.team1} team2={match.team2} />}
        </div>
      )}
    </div>
  );
}
