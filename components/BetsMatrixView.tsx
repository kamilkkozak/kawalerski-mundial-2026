"use client";

import { useMemo, useState } from "react";
import type { Match, Stage } from "@/lib/types";
import { isLocked, lockAtMs, scoreMatch } from "@/lib/scoring";
import { fmtDay, fmtTime, fmtCountdown } from "@/lib/ui";
import { I } from "./icons";
import Flag from "./Flag";
import Avatar from "./Avatar";

type PlayerLite = { id: string; name: string; avatar_url: string | null };
type FilterKey = "now" | "all" | Stage;

const STAGE_FILTERS: { key: FilterKey; label: string }[] = [
  { key: "now", label: "Najbliższe" },
  { key: "all", label: "Wszystkie" },
  { key: "group", label: "Grupowa" },
  { key: "r32", label: "1/16" },
  { key: "r16", label: "1/8" },
  { key: "qf", label: "Ćwierć" },
  { key: "sf", label: "Półfinał" },
  { key: "third", label: "o 3." },
  { key: "final", label: "Finał" },
];

function isFinished(m: Match): boolean {
  return m.status === "FINISHED" && m.score1 != null && m.score2 != null;
}
function isLive(m: Match): boolean {
  return m.status === "IN_PLAY" || m.status === "PAUSED";
}

// not-finished rosnąco po kickoffie, potem finished malejąco (najświeższe wyżej)
function byTimeline(a: Match, b: Match): number {
  const fa = isFinished(a), fb = isFinished(b);
  if (fa !== fb) return fa ? 1 : -1;
  const ka = +new Date(a.kickoff), kb = +new Date(b.kickoff);
  return fa ? kb - ka : ka - kb;
}

export default function BetsMatrixView({
  matches,
  players,
  statusSet,
  predValues,
  meId,
  now,
  onOpenMatch,
}: {
  matches: Match[];
  players: PlayerLite[];
  statusSet: Set<string>;
  predValues: Map<string, { pred1: number; pred2: number }>;
  meId: string;
  now: number;
  onOpenMatch: (m: Match) => void;
}) {
  const [filter, setFilter] = useState<FilterKey>("now");
  const [group, setGroup] = useState<string | null>(null);

  // ja na górze, reszta alfabetycznie
  const orderedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (a.id === meId) return -1;
      if (b.id === meId) return 1;
      return a.name.localeCompare(b.name, "pl");
    });
  }, [players, meId]);

  const groupLabels = useMemo(() => {
    const s = new Set<string>();
    for (const m of matches) if (m.stage === "group" && m.group_label) s.add(m.group_label);
    return Array.from(s).sort();
  }, [matches]);

  const visible = useMemo(() => {
    if (filter === "now") {
      // "Najbliższe": mecze dzisiejsze i jutrzejsze (lokalna data), chronologicznie.
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(start); end.setDate(end.getDate() + 2); // do końca jutra
      const s = start.getTime(), e = end.getTime();
      return matches
        .filter((m) => { const k = +new Date(m.kickoff); return k >= s && k < e; })
        .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
    }
    let list = filter === "all" ? matches : matches.filter((m) => m.stage === filter);
    if (filter === "group" && group) list = list.filter((m) => m.group_label === group);
    return [...list].sort(byTimeline);
  }, [matches, filter, group, now]);

  return (
    <div className="bets-view">
      <div className="bm-filters">
        {STAGE_FILTERS.map((f) => (
          <button
            key={f.key}
            className={`bm-chip ${filter === f.key ? "on" : ""}`}
            onClick={() => { setFilter(f.key); if (f.key !== "group") setGroup(null); }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filter === "group" && groupLabels.length > 0 && (
        <div className="bm-filters sub">
          <button className={`bm-chip sm ${group === null ? "on" : ""}`} onClick={() => setGroup(null)}>Wszystkie grupy</button>
          {groupLabels.map((g) => (
            <button key={g} className={`bm-chip sm ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>Grupa {g}</button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="panel" style={{ padding: 26, color: "var(--muted)", fontSize: 13 }}>Brak meczów dla tego filtra.</div>
      ) : (
        <div className="bm-list">
          {visible.map((m) => (
            <MatchBets key={m.id} m={m} players={orderedPlayers} statusSet={statusSet} predValues={predValues} meId={meId} now={now} onOpenMatch={onOpenMatch} />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchBets({
  m, players, statusSet, predValues, meId, now, onOpenMatch,
}: {
  m: Match;
  players: PlayerLite[];
  statusSet: Set<string>;
  predValues: Map<string, { pred1: number; pred2: number }>;
  meId: string;
  now: number;
  onOpenMatch: (m: Match) => void;
}) {
  const finished = isFinished(m);
  const live = isLive(m);
  const locked = finished || isLocked(m.kickoff, now);
  const hasScore = m.score1 != null && m.score2 != null; // wynik (live lub końcowy)
  // "obstawił" = jest w statusSet (RPC presence) LUB mamy widoczną wartość (mój typ / po blokadzie)
  const hasBet = (pid: string) => statusSet.has(`${pid}|${m.id}`) || predValues.has(`${pid}|${m.id}`);
  const predictedCount = players.reduce((n, p) => n + (hasBet(p.id) ? 1 : 0), 0);

  // licznik zamknięcia per mecz (styl jak day-deadline w fazie grupowej)
  let closeKind = "open";
  let closeText = "";
  if (live) { closeKind = "live"; closeText = "Trwają mecze"; }
  else if (finished) { closeKind = "done"; closeText = "Po meczu"; }
  else if (locked) { closeKind = "closed"; closeText = "Zamknięte"; }
  else { closeKind = "open"; closeText = `Zamknięcie za ${fmtCountdown(lockAtMs(m.kickoff) - now)}`; }

  return (
    <div className="panel bm-match">
      <div className="bm-head">
        <span className="bm-when">{fmtDay(m.kickoff)} · {fmtTime(m.kickoff)}</span>
        <div className="bm-teams">
          <Flag name={m.team1} /><span className="bm-tname">{m.team1}</span>
          <span className="bm-score">{finished || live ? `${m.score1 ?? 0} : ${m.score2 ?? 0}` : "vs"}</span>
          <span className="bm-tname right">{m.team2}</span><Flag name={m.team2} />
        </div>
        <span className="bm-meta">
          <span className={`bm-close ${closeKind}`}>{closeText}</span>
          <span className="bm-count">{predictedCount}/{players.length} obstawiło</span>
        </span>
      </div>

      <div className="bm-players">
        {players.map((p) => {
          const key = `${p.id}|${m.id}`;
          const val = predValues.get(key);
          const predicted = statusSet.has(key) || !!val;
          const isMe = p.id === meId;
          // punkty dla wytypowanego wyniku, gdy mecz ma wynik (live lub końcowy)
          const pts = val && hasScore ? scoreMatch({ a: val.pred1, b: val.pred2 }, { a: m.score1, b: m.score2 }) : null;
          const ptsCls = pts === 3 ? "p3" : pts === 1 ? "p1" : pts === 0 ? "p0" : "";

          let cell: React.ReactNode;
          if (locked) {
            cell = val
              ? <span className={`bm-pick val ${ptsCls}`}>{val.pred1}:{val.pred2}</span>
              : <span className="bm-pick none">nie typował</span>;
          } else if (isMe && val) {
            cell = <span className="bm-pick val mine">{val.pred1}:{val.pred2}</span>;
          } else if (predicted) {
            cell = <span className="bm-pick hidden">{I.lock}<b>•:•</b></span>;
          } else {
            cell = <span className="bm-pick none">—</span>;
          }

          const clickable = isMe && !finished;
          const inner = (
            <>
              <span className={`bm-dot ${predicted ? "yes" : "no"}`} />
              <Avatar name={p.name} seed={p.id} size={26} avatarUrl={p.avatar_url} />
              <span className="bm-pname">{p.name}{isMe ? " (Ty)" : ""}</span>
              {cell}
              {pts != null && <span className={`bm-pts p${pts}`}>+{pts}</span>}
            </>
          );
          return clickable ? (
            <button key={p.id} className="bm-prow me clickable" onClick={() => onOpenMatch(m)} title={locked ? "Podgląd typu" : "Kliknij, aby obstawić"}>
              {inner}
            </button>
          ) : (
            <div key={p.id} className={`bm-prow ${isMe ? "me" : ""}`}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
