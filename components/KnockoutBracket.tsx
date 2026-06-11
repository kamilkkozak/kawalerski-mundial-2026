"use client";

import { useMemo } from "react";
import type { Match, Stage } from "@/lib/types";
import { LAYOUT, refLabel, isResolved } from "@/lib/bracket";
import { I } from "./icons";
import Flag from "./Flag";

const KB = { NODE_W: 168, NODE_H: 50, V_GAP: 16, COL_GAP: 60, LABEL_H: 44, TOP_PAD: 10 };
const SLOT = KB.NODE_H + KB.V_GAP;
const X_STEP = KB.NODE_W + KB.COL_GAP;

const baseY = Array.from({ length: 8 }, (_, i) => KB.LABEL_H + KB.TOP_PAD + i * SLOT + KB.NODE_H / 2);
const mid = (arr: number[]) => {
  const out: number[] = [];
  for (let i = 0; i < arr.length; i += 2) out.push((arr[i] + arr[i + 1]) / 2);
  return out;
};
const y4 = mid(baseY);
const y2 = mid(y4);
const y1 = mid(y2);

type RoundKey = "r32" | "r16" | "qf" | "sf";
type Col = { gi: number; side: "L" | "R" | "C"; round: Stage; n: number; ys: number[] };
const COLS: Col[] = [
  { gi: 0, side: "L", round: "r32", n: 8, ys: baseY },
  { gi: 1, side: "L", round: "r16", n: 4, ys: y4 },
  { gi: 2, side: "L", round: "qf", n: 2, ys: y2 },
  { gi: 3, side: "L", round: "sf", n: 1, ys: y1 },
  { gi: 4, side: "C", round: "final", n: 1, ys: y1 },
  { gi: 5, side: "R", round: "sf", n: 1, ys: y1 },
  { gi: 6, side: "R", round: "qf", n: 2, ys: y2 },
  { gi: 7, side: "R", round: "r16", n: 4, ys: y4 },
  { gi: 8, side: "R", round: "r32", n: 8, ys: baseY },
];
const xAt = (gi: number) => gi * X_STEP;
const ROUND_LABEL: Record<string, string> = { r32: "1/16", r16: "1/8", qf: "ĆWIERĆFINAŁ", sf: "PÓŁFINAŁ", final: "FINAŁ" };

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function KnockoutBracket({
  matches,
  onOpenMatch,
}: {
  matches: Match[];
  onOpenMatch: (m: Match) => void;
}) {
  // Mapa kod meczu -> mecz (układ drabinki sterowany kodami, nie kolejnością czasu).
  const byCode = useMemo(() => {
    const m = new Map<string, Match>();
    matches.forEach((x) => x.bracket_code && m.set(x.bracket_code, x));
    return m;
  }, [matches]);

  const hasAny = matches.some((x) => x.stage !== "group");

  function getMatch(col: Col, i: number): Match | undefined {
    if (col.round === "final") return byCode.get(LAYOUT.final);
    const side = col.side === "L" ? LAYOUT.L : LAYOUT.R;
    const code = side[col.round as RoundKey]?.[i];
    return code ? byCode.get(code) : undefined;
  }

  const nodes: { col: Col; i: number; x: number; y: number; match?: Match }[] = [];
  COLS.forEach((col) => {
    for (let i = 0; i < col.n; i++) {
      nodes.push({ col, i, x: xAt(col.gi), y: col.ys[i], match: getMatch(col, i) });
    }
  });

  // linie łączące (geometria, niezależna od danych)
  const lines: { pts: number[][]; teal?: boolean }[] = [];
  const elbow = (cx: number, cy: number, px: number, py: number, dir: "R" | "L") => {
    if (dir === "R") {
      const cRight = cx + KB.NODE_W, pLeft = px, mx = (cRight + pLeft) / 2;
      return [[cRight, cy], [mx, cy], [mx, py], [pLeft, py]];
    }
    const cLeft = cx, pRight = px + KB.NODE_W, mx = (cLeft + pRight) / 2;
    return [[cLeft, cy], [mx, cy], [mx, py], [pRight, py]];
  };
  for (let c = 0; c < 3; c++) {
    const child = COLS[c], parent = COLS[c + 1];
    for (let j = 0; j < parent.n; j++) {
      lines.push({ pts: elbow(xAt(child.gi), child.ys[2 * j], xAt(parent.gi), parent.ys[j], "R") });
      lines.push({ pts: elbow(xAt(child.gi), child.ys[2 * j + 1], xAt(parent.gi), parent.ys[j], "R") });
    }
  }
  for (let c = 8; c > 5; c--) {
    const child = COLS[c], parent = COLS[c - 1];
    for (let j = 0; j < parent.n; j++) {
      lines.push({ pts: elbow(xAt(child.gi), child.ys[2 * j], xAt(parent.gi), parent.ys[j], "L") });
      lines.push({ pts: elbow(xAt(child.gi), child.ys[2 * j + 1], xAt(parent.gi), parent.ys[j], "L") });
    }
  }
  const yC = y1[0];
  lines.push({ pts: [[xAt(3) + KB.NODE_W, yC], [xAt(4), yC]], teal: true });
  lines.push({ pts: [[xAt(5), yC], [xAt(4) + KB.NODE_W, yC]], teal: true });

  const W = xAt(8) + KB.NODE_W;
  const H = baseY[7] + KB.NODE_H / 2 + 110;
  const third = byCode.get(LAYOUT.third);

  if (!hasAny) {
    return (
      <div className="empty-state">
        <h3>Drabinka jeszcze pusta</h3>
        <p>Pary pucharowe pojawią się po fazie grupowej.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="kb-scroll">
        <div className="kb-stage" style={{ width: W, height: H }}>
          {COLS.map((col) => (
            <div key={"lab" + col.gi} className={`kb-collabel ${col.round === "final" ? "final" : ""}`} style={{ left: xAt(col.gi), width: KB.NODE_W }}>
              {ROUND_LABEL[col.round]}
            </div>
          ))}
          <svg className="kb-lines" width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
            {lines.map((ln, i) => (
              <polyline key={i} points={ln.pts.map((p) => p.join(",")).join(" ")} fill="none"
                stroke={ln.teal ? "var(--accent-2)" : "var(--accent)"} strokeWidth="2" strokeOpacity={ln.teal ? 0.95 : 0.65} strokeLinejoin="round" />
            ))}
          </svg>

          {nodes.map((n, i) => (
            <KbNode key={i} col={n.col} x={n.x} y={n.y} match={n.match} onOpen={onOpenMatch} />
          ))}

          {third && (
            <ThirdNode match={third} left={xAt(4) - 12} top={yC + 92} width={KB.NODE_W + 24} onOpen={onOpenMatch} />
          )}
        </div>
      </div>
    </div>
  );
}

function KbNode({
  col, x, y, match, onOpen,
}: { col: Col; x: number; y: number; match?: Match; onOpen: (m: Match) => void }) {
  const isFinal = col.round === "final";
  const resolved = match ? isResolved(match.team1, match.team2) : false;
  const hasResult = !!match && match.score1 != null && match.score2 != null && match.status === "FINISHED";
  const clickable = !!match && (resolved || hasResult);
  return (
    <div
      className={`kb-node ${isFinal ? "final" : ""}`}
      style={{ left: x, top: y - KB.NODE_H / 2, width: KB.NODE_W, cursor: clickable ? "pointer" : "default" }}
      onClick={() => clickable && match && onOpen(match)}
    >
      <div className="kb-hex" />
      <div className="kb-hex inner" />
      <div className="kb-rows">
        {isFinal ? (
          <div className="kb-final-rows">
            <span className="kb-cup">{I.cup}</span>
            <div>
              <div className="kb-final-t">FINAŁ</div>
              <div className="kb-final-s">{match ? shortDate(match.kickoff) : "19.07"} · MetLife</div>
            </div>
          </div>
        ) : (
          <>
            <Slot name={match?.team1} slotRef={match?.home_ref} score={match?.score1} when={match ? shortDate(match.kickoff) : undefined} />
            <Slot name={match?.team2} slotRef={match?.away_ref} score={match?.score2} />
          </>
        )}
      </div>
    </div>
  );
}

function ThirdNode({
  match, left, top, width, onOpen,
}: { match: Match; left: number; top: number; width: number; onOpen: (m: Match) => void }) {
  const resolved = isResolved(match.team1, match.team2);
  const hasResult = match.score1 != null && match.score2 != null && match.status === "FINISHED";
  const clickable = resolved || hasResult;
  return (
    <div className="kb-third" style={{ left, top, width, cursor: clickable ? "pointer" : "default" }} onClick={() => clickable && onOpen(match)}>
      <div className="kb-hex" />
      <div className="kb-hex inner" />
      <div className="kb-rows"><div className="kb-third-lab">MECZ O 3. MIEJSCE<small>{shortDate(match.kickoff)}</small></div></div>
    </div>
  );
}

// `slotRef` to deskryptor slotu (np. "1E", "W73") — pokazywany gdy drużyna nieznana.
function Slot({ name, slotRef, score, when }: { name?: string | null; slotRef?: string | null; score?: number | null; when?: string }) {
  const known = !!name && name !== "TBD";
  return (
    <div className={`kb-slot ${known ? "" : "dim"}`}>
      {known ? <Flag name={name} /> : <span className="kb-dot" />}
      <span className={known ? "kb-team" : "kb-tbd"}>{known ? name : refLabel(slotRef)}</span>
      {score != null && <span className="kb-seed">{score}</span>}
      {when && <span className="kb-when">{when}</span>}
    </div>
  );
}
