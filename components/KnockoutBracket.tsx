"use client";

import { useMemo } from "react";
import type { Match, Stage } from "@/lib/types";
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

export default function KnockoutBracket({ matches }: { matches: Match[] }) {
  const byStage = useMemo(() => {
    const m: Record<string, Match[]> = {};
    matches
      .filter((x) => x.stage !== "group")
      .forEach((x) => {
        (m[x.stage] ||= []).push(x);
      });
    Object.values(m).forEach((list) => list.sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff)));
    return m;
  }, [matches]);

  const hasAny = Object.keys(byStage).length > 0;

  function getMatch(col: Col, i: number): Match | undefined {
    const list = byStage[col.round] ?? [];
    if (col.round === "final" || col.side === "C") return list[0];
    const offset = col.side === "L" ? 0 : col.n; // prawa połowa = druga część listy
    return list[offset + i];
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
  const third = byStage["third"]?.[0];

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
      <div className="board-head">
        <div className="hint">
          Pełna drabinka — od <b>1/16 finału</b> po <b>FINAŁ</b> w centrum. Drużyny i pary uzupełnią się <b>automatycznie</b> po fazie grupowej (dane z football-data.org). Typowanie meczów pucharowych włączymy, gdy pary będą znane.
        </div>
      </div>

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
            <KbNode key={i} col={n.col} x={n.x} y={n.y} match={n.match} />
          ))}

          {third && (
            <div className="kb-third" style={{ left: xAt(4) - 12, top: yC + 92, width: KB.NODE_W + 24 }}>
              <div className="kb-hex" />
              <div className="kb-hex inner" />
              <div className="kb-rows"><div className="kb-third-lab">MECZ O 3. MIEJSCE<small>{shortDate(third.kickoff)}</small></div></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KbNode({ col, x, y, match }: { col: Col; x: number; y: number; match?: Match }) {
  const isFinal = col.round === "final";
  const known = (t?: string | null) => t && t !== "TBD";
  return (
    <div className={`kb-node ${isFinal ? "final" : ""}`} style={{ left: x, top: y - KB.NODE_H / 2, width: KB.NODE_W }}>
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
            <Slot name={match?.team1} score={match?.score1} known={!!known(match?.team1)} when={match ? shortDate(match.kickoff) : undefined} />
            <Slot name={match?.team2} score={match?.score2} known={!!known(match?.team2)} />
          </>
        )}
      </div>
    </div>
  );
}

function Slot({ name, score, known, when }: { name?: string | null; score?: number | null; known: boolean; when?: string }) {
  return (
    <div className={`kb-slot ${known ? "" : "dim"}`}>
      {known ? <Flag name={name} /> : <span className="kb-dot" />}
      <span className={known ? "kb-team" : "kb-tbd"}>{known ? name : "do ustalenia"}</span>
      {score != null && <span className="kb-seed">{score}</span>}
      {when && <span className="kb-when">{when}</span>}
    </div>
  );
}
