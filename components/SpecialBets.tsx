"use client";

import { useMemo, useState, useTransition } from "react";
import type { BonusPick, Match, Settings } from "@/lib/types";
import { TEAMS } from "@/lib/teams";
import { LOCK_MS } from "@/lib/scoring";
import { saveBonus } from "@/app/actions";
import { I } from "./icons";
import Flag from "./Flag";

// Podpowiedzi króla strzelców (kosmetyka — pole jest tekstowe, można wpisać dowolnego).
const SCORER_HINTS = [
  { name: "Kylian Mbappé", team: "Francja" },
  { name: "Erling Haaland", team: "Norwegia" },
  { name: "Harry Kane", team: "Anglia" },
  { name: "Vinícius Júnior", team: "Brazylia" },
  { name: "Lionel Messi", team: "Argentyna" },
  { name: "Lamine Yamal", team: "Hiszpania" },
  { name: "Cristiano Ronaldo", team: "Portugalia" },
  { name: "Robert Lewandowski", team: "Polska" },
];

export default function SpecialBets({
  bonus,
  setBonus,
  settings,
  matches,
  now,
  onToast,
}: {
  bonus: BonusPick;
  setBonus: (b: BonusPick) => void;
  settings: Settings | null;
  matches: Match[];
  now: number;
  onToast: (msg: string, err?: boolean) => void;
}) {
  const tournamentStart = useMemo(
    () => (matches.length ? Math.min(...matches.map((m) => +new Date(m.kickoff))) : Infinity),
    [matches]
  );
  const locked = now >= tournamentStart - LOCK_MS;

  const [champ, setChamp] = useState(bonus.champion ?? "");
  const [scorer, setScorer] = useState(bonus.top_scorer ?? "");
  const [pending, startTransition] = useTransition();

  function persist(nextChamp: string, nextScorer: string) {
    startTransition(async () => {
      const res = await saveBonus(nextChamp, nextScorer);
      if (res.ok) {
        setBonus({ ...bonus, champion: nextChamp || null, top_scorer: nextScorer || null });
        onToast("Typ specjalny zapisany");
      } else onToast(res.error ?? "Błąd zapisu", true);
    });
  }

  function pickChamp(name: string) {
    if (locked) { onToast("Typy specjalne zamknięte (start turnieju)", true); return; }
    setChamp(name);
    persist(name, scorer);
  }
  function commitScorer(val: string) {
    if (locked) return;
    persist(champ, val);
  }

  return (
    <div>
      <div className="board-head">
        <div className="hint">
          Dwa typy za <b>cały turniej</b>: mistrz świata i król strzelców. Każdy trafiony to <b>+10 pkt</b> na koniec. Deadline: pierwszy gwizdek mistrzostw.
        </div>
      </div>

      <div className="special-grid">
        <div className="special-card">
          <h3>{I.cup} Mistrz świata <span className="sc-bonus">+10 pkt</span></h3>
          <div className="sc-sub">
            {locked ? <>Twój typ jest <b style={{ color: "var(--warn)" }}>zablokowany</b>. </> : "Wybierz reprezentację. "}
            {champ && <>Wybór: <b style={{ color: "var(--accent)" }}>{champ}</b>.</>}
          </div>
          <div className="pick-grid">
            {TEAMS.map((t) => (
              <button key={t.name} className={`pick ${champ === t.name ? "sel" : ""}`} disabled={locked} onClick={() => pickChamp(t.name)}>
                <Flag name={t.name} />
                <span style={{ flex: 1, textAlign: "left" }}>{t.name}</span>
                {champ === t.name && <span style={{ color: "var(--accent)" }}>{I.check}</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="special-card">
          <h3>{I.star} Król strzelców <span className="sc-bonus">+10 pkt</span></h3>
          <div className="sc-sub">
            {locked ? <>Twój typ: <b style={{ color: "var(--accent)" }}>{scorer || "—"}</b>. <span style={{ color: "var(--warn)" }}>Zablokowany.</span></> : "Wpisz nazwisko zawodnika (dowolne)."}
          </div>
          <input
            className="scorer-input"
            value={scorer}
            disabled={locked}
            placeholder="np. Lewandowski"
            onChange={(e) => setScorer(e.target.value)}
            onBlur={(e) => commitScorer(e.target.value)}
          />
          {!locked && (
            <div className="scorer-chips">
              {SCORER_HINTS.map((s) => (
                <button key={s.name} className="scorer-chip" onClick={() => { setScorer(s.name); commitScorer(s.name); }}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          {settings?.top_scorer_result && (
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
              Oficjalny król strzelców: <b style={{ color: "var(--text)" }}>{settings.top_scorer_result}</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
