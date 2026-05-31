"use client";

import { useEffect, useState, useTransition } from "react";
import type { Match } from "@/lib/types";
import { isLocked, lockAtMs } from "@/lib/scoring";
import { stageLabel } from "@/lib/stages";
import { fmtCountdown, fmtDay, fmtTime } from "@/lib/ui";
import { savePrediction } from "@/app/actions";
import { I } from "./icons";
import Flag from "./Flag";

export default function PredictionModal({
  match,
  pred,
  now,
  onSaved,
  onClose,
}: {
  match: Match;
  pred?: { pred1: number; pred2: number };
  now: number;
  onSaved: (matchId: number, p1: number, p2: number) => void;
  onClose: () => void;
}) {
  const [h, setH] = useState<string>(pred ? String(pred.pred1) : "");
  const [a, setA] = useState<string>(pred ? String(pred.pred2) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Własny zegar 1 s — płynne odliczanie niezależnie od taktu shella.
  const [clock, setClock] = useState(now);
  useEffect(() => {
    const id = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const lockMs = lockAtMs(match.kickoff);
  const diff = lockMs - clock;
  const locked = isLocked(match.kickoff, clock);
  const hasTeams = match.team1 !== "TBD" && match.team2 !== "TBD";

  const clamp = (v: number) => Math.max(0, Math.min(99, v));
  const setScore = (which: "h" | "a", v: string) => {
    const clean = v.replace(/\D/g, "").slice(0, 2);
    which === "h" ? setH(clean) : setA(clean);
  };
  const bump = (which: "h" | "a", d: number) => {
    const cur = which === "h" ? (h === "" ? 0 : +h) : (a === "" ? 0 : +a);
    const n = clamp(cur + d);
    which === "h" ? setH(String(n)) : setA(String(n));
  };

  const canSave = h !== "" && a !== "" && !locked && !pending && hasTeams;

  function save() {
    if (h === "" || a === "") return;
    const p1 = +h;
    const p2 = +a;
    setError(null);
    startTransition(async () => {
      const res = await savePrediction(match.id, p1, p2);
      if (res.ok) onSaved(match.id, p1, p2);
      else setError(res.error ?? "Błąd zapisu");
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter" && canSave) save();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const stageTxt = match.group_label
    ? `Grupa ${match.group_label}`
    : stageLabel(match.stage);

  return (
    <div className="modal-scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-top">
          <span className="mt-stage">{stageTxt}</span>
          <span className="mt-when">{fmtDay(match.kickoff)}, {fmtTime(match.kickoff)}</span>
          <button className="modal-close" onClick={onClose}>{I.x}</button>
        </div>

        <div className="score-stage">
          <div className="score-team">
            <Flag name={match.team1} />
            <span className="tn">{match.team1}</span>
          </div>
          <div className="score-input-wrap">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input className="score-input" value={h} disabled={locked} inputMode="numeric" placeholder="–"
                onChange={(e) => setScore("h", e.target.value)} autoFocus={!locked} />
              <span className="score-vs">:</span>
              <input className="score-input" value={a} disabled={locked} inputMode="numeric" placeholder="–"
                onChange={(e) => setScore("a", e.target.value)} />
            </div>
            {!locked && (
              <div style={{ display: "flex", gap: 26, marginTop: 2 }}>
                <div className="stepper">
                  <button onClick={() => bump("h", -1)}>−</button>
                  <button onClick={() => bump("h", +1)}>+</button>
                </div>
                <div className="stepper">
                  <button onClick={() => bump("a", -1)}>−</button>
                  <button onClick={() => bump("a", +1)}>+</button>
                </div>
              </div>
            )}
          </div>
          <div className="score-team">
            <Flag name={match.team2} />
            <span className="tn">{match.team2}</span>
          </div>
        </div>

        <div className="modal-foot">
          {locked ? (
            <div className="locked-note" style={{ marginBottom: 14 }}>
              {I.lock}
              <span>Typowanie tego meczu jest <b>zamknięte</b> (60 s przed gwizdkiem). {pred ? `Twój typ: ${pred.pred1}:${pred.pred2}.` : "Typ przepadł."}</span>
            </div>
          ) : (
            <>
              <div className="scoring-legend">
                <span className="leg-item"><span className="leg-dot p3">3</span> dokładny wynik</span>
                <span className="leg-item"><span className="leg-dot p1">1</span> trafiony zwycięzca / remis</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7 }}>
                Zamknięcie typu: <b style={{ color: diff < 3600000 ? "var(--warn)" : "var(--text)" }}>{fmtCountdown(diff)}</b>
              </div>
            </>
          )}
          {error && <div style={{ color: "var(--bad)", fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>}
          <div className="modal-actions">
            <button className="btn btn-ghost" onClick={onClose}>{locked ? "Zamknij" : "Anuluj"}</button>
            {!locked && (
              <button className="btn btn-primary" disabled={!canSave} onClick={save}>
                {pending ? "Zapisuję…" : <>Zapisz typ {I.check}</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
