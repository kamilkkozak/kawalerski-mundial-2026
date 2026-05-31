"use client";

import { useMemo, useState } from "react";
import type { Match, PredMap } from "@/lib/types";
import { isLocked, scoreMatch } from "@/lib/scoring";
import { fmtTime } from "@/lib/ui";
import { I } from "./icons";
import Flag from "./Flag";

type GroupData = { label: string; teams: string[]; matches: Match[] };

export default function GroupBoard({
  matches,
  preds,
  now,
  onOpenMatch,
}: {
  matches: Match[];
  preds: PredMap;
  now: number;
  onOpenMatch: (m: Match) => void;
}) {
  const groups = useMemo<GroupData[]>(() => {
    const map: Record<string, Match[]> = {};
    matches
      .filter((m) => m.stage === "group" && m.group_label)
      .forEach((m) => {
        (map[m.group_label!] ||= []).push(m);
      });
    return Object.keys(map)
      .sort()
      .map((label) => {
        const ms = map[label].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
        const teams: string[] = [];
        ms.forEach((m) => {
          if (!teams.includes(m.team1)) teams.push(m.team1);
          if (!teams.includes(m.team2)) teams.push(m.team2);
        });
        return { label, teams, matches: ms };
      });
  }, [matches]);

  const [sel, setSel] = useState<{ group: string; name: string } | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ group: string; name: string } | null>(null);

  function matchBetween(g: GroupData, a: string, b: string) {
    return g.matches.find(
      (m) => (m.team1 === a && m.team2 === b) || (m.team1 === b && m.team2 === a)
    );
  }

  function pick(g: GroupData, team: string) {
    if (sel && sel.group === g.label && sel.name === team) {
      setSel(null);
      return;
    }
    if (sel && sel.group === g.label) {
      const m = matchBetween(g, sel.name, team);
      setSel(null);
      if (m) onOpenMatch(m);
      return;
    }
    setSel({ group: g.label, name: team });
  }

  function drop(g: GroupData, team: string) {
    if (dragging && dragging.group === g.label && dragging.name !== team) {
      const m = matchBetween(g, dragging.name, team);
      if (m) onOpenMatch(m);
    }
    setDragging(null);
    setDragOver(null);
    setSel(null);
  }

  return (
    <div>
      <div className="board-head">
        <div className="hint">
          Typuj parując drużyny: kliknij jedną, potem jej rywala w tej samej grupie — albo <b>przeciągnij</b> jedną na drugą. Otworzy się okno typowania danego meczu.
        </div>
      </div>

      <div className="groups-grid">
        {groups.map((g) => {
          const pairingHere = sel?.group === g.label;
          const dimGroup = sel != null && sel.group !== g.label;
          const typed = g.matches.filter((m) => preds[m.id]).length;
          return (
            <div key={g.label} className={`group-card ${pairingHere ? "pairing" : ""}`}>
              <div className="group-title">
                <span className="gl">GRUPA {g.label}</span>
                <span className="gmeta">{typed}/6 typów</span>
              </div>

              {g.teams.map((team) => {
                const isSel = sel?.group === g.label && sel?.name === team;
                const key = `${g.label}|${team}`;
                return (
                  <div
                    key={team}
                    className={`team-row ${isSel ? "selected" : ""} ${dimGroup ? "dim" : ""} ${dragOver === key ? "dragover" : ""}`}
                    draggable={!dimGroup}
                    onClick={() => !dimGroup && pick(g, team)}
                    onDragStart={(e) => { setDragging({ group: g.label, name: team }); e.dataTransfer.effectAllowed = "link"; }}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    onDragOver={(e) => { if (dragging && dragging.group === g.label && dragging.name !== team) { e.preventDefault(); setDragOver(key); } }}
                    onDragLeave={() => setDragOver((o) => (o === key ? null : o))}
                    onDrop={(e) => { e.preventDefault(); drop(g, team); }}
                  >
                    <Flag name={team} />
                    <span className="team-name">{team}</span>
                    <span className="team-grab">{I.grab}</span>
                  </div>
                );
              })}

              {pairingHere ? (
                <div className="pair-hint">{I.arrow} wybierz rywala dla: {sel!.name}</div>
              ) : (
                <FixMini group={g} preds={preds} now={now} onOpenMatch={onOpenMatch} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FixMini({
  group,
  preds,
  now,
  onOpenMatch,
}: {
  group: GroupData;
  preds: PredMap;
  now: number;
  onOpenMatch: (m: Match) => void;
}) {
  return (
    <div className="fixmini">
      {group.matches.map((m) => {
        const locked = isLocked(m.kickoff, now);
        const pred = preds[m.id];
        const hasResult = m.score1 != null && m.score2 != null && m.status === "FINISHED";
        return (
          <div key={m.id} className={`fixmini-row ${locked ? "locked" : ""}`} onClick={() => onOpenMatch(m)}>
            <span className="fm-when">{fmtTime(m.kickoff)}</span>
            <span className="fm-vs">{m.team1.slice(0, 3).toUpperCase()} – {m.team2.slice(0, 3).toUpperCase()}</span>
            {hasResult ? (
              <span className="fm-pred" style={{ color: "var(--text)" }}>{m.score1}:{m.score2}</span>
            ) : locked ? (
              <span className="fm-pred locked" style={{ opacity: 0.5 }}>—</span>
            ) : (
              <span className={`fm-pred ${pred ? "" : "locked"}`}>{pred ? `${pred.pred1}:${pred.pred2}` : "+"}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
