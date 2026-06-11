"use client";

import { useMemo, useState, useTransition } from "react";
import type { BonusPick, Match, Settings, Scorer } from "@/lib/types";
import { TEAMS } from "@/lib/teams";
import { LOCK_MS } from "@/lib/scoring";
import { fmtDateTime, fmtCountdown } from "@/lib/ui";
import { saveBonus, lockTopScorer, lockChampion } from "@/app/actions";
import { I } from "./icons";
import Flag from "./Flag";
import ScorerPicker from "./ScorerPicker";

// Jeden komponent, dwa widoki (mode). Oba zapisują przez set_bonus(champion, scorer),
// więc pole nieedytowane w danym widoku przepuszczamy z `bonus` (źródło prawdy w AppShell).
export default function SpecialBets({
  mode,
  bonus,
  setBonus,
  settings,
  matches,
  now,
  onToast,
  scorers = [],
}: {
  mode: "champion" | "scorer";
  bonus: BonusPick;
  setBonus: (b: BonusPick) => void;
  settings: Settings | null;
  matches: Match[];
  now: number;
  onToast: (msg: string, err?: boolean) => void;
  scorers?: Scorer[];
}) {
  const tournamentStart = useMemo(
    () => (matches.length ? Math.min(...matches.map((m) => +new Date(m.kickoff))) : Infinity),
    [matches]
  );
  const locked = now >= tournamentStart - LOCK_MS;

  const [champ, setChamp] = useState(bonus.champion ?? "");
  const [scorer, setScorer] = useState(bonus.top_scorer ?? "");
  const [pending, startTransition] = useTransition();
  const [confirming, startConfirm] = useTransition();

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
  function confirmChampion() {
    if (!champ || locked || bonus.champion_locked) return;
    if (!window.confirm(`Zatwierdzić „${champ}" jako mistrza świata? Po zatwierdzeniu nie zmienisz już typu.`)) return;
    startConfirm(async () => {
      const res = await lockChampion();
      if (res.ok) {
        setBonus({ ...bonus, champion: champ, champion_locked: true });
        onToast("Typ zatwierdzony");
      } else onToast(res.error ?? "Błąd", true);
    });
  }
  function confirmScorer() {
    if (!scorer || locked || bonus.top_scorer_locked) return;
    if (!window.confirm(`Zatwierdzić „${scorer}" jako króla strzelców? Po zatwierdzeniu nie zmienisz już typu.`)) return;
    startConfirm(async () => {
      const res = await lockTopScorer();
      if (res.ok) {
        setBonus({ ...bonus, top_scorer: scorer, top_scorer_locked: true });
        onToast("Typ zatwierdzony");
      } else onToast(res.error ?? "Błąd", true);
    });
  }

  if (mode === "champion") {
    const champConfirmed = bonus.champion_locked === true;
    const champReadOnly = locked || champConfirmed;
    return (
      <div>
        <LockCountdown now={now} lockAt={tournamentStart - LOCK_MS} />
        <div className="special-card">
          <div className="sc-sub">
            {champReadOnly ? (
              <>Twój typ: <b style={{ color: "var(--accent)" }}>{champ || "—"}</b>. <span style={{ color: "var(--warn)" }}>{champConfirmed ? "Zatwierdzony — nie można zmienić." : "Zablokowany."}</span></>
            ) : (
              <>Wybierz reprezentację{champ ? <> — wybór: <b style={{ color: "var(--accent)" }}>{champ}</b></> : null} i zatwierdź.</>
            )}
          </div>
          {!champReadOnly && (
            <>
              <div className="pick-grid">
                {TEAMS.map((t) => (
                  <button key={t.name} className={`pick ${champ === t.name ? "sel" : ""}`} onClick={() => pickChamp(t.name)}>
                    <Flag name={t.name} />
                    <span style={{ flex: 1, textAlign: "left" }}>{t.name}</span>
                    {champ === t.name && <span style={{ color: "var(--accent)" }}>{I.check}</span>}
                  </button>
                ))}
              </div>
              {champ && (
                <button className="btn btn-primary sc-confirm" disabled={confirming} onClick={confirmChampion}>
                  {confirming ? "Zatwierdzanie…" : <>{I.check} Zatwierdź wybór</>}
                </button>
              )}
            </>
          )}
          {settings?.champion_result && (
            <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
              Oficjalny mistrz: <b style={{ color: "var(--text)" }}>{settings.champion_result}</b>
            </div>
          )}
        </div>
      </div>
    );
  }

  const confirmed = bonus.top_scorer_locked === true;
  const readOnly = locked || confirmed;

  return (
    <div>
      <LockCountdown now={now} lockAt={tournamentStart - LOCK_MS} />
      <div className="special-card">
        <div className="sc-sub">
          {readOnly ? (
            <>Twój typ: <b style={{ color: "var(--accent)" }}>{scorer || "—"}</b>. <span style={{ color: "var(--warn)" }}>{confirmed ? "Zatwierdzony — nie można zmienić." : "Zablokowany."}</span></>
          ) : (
            "Wybierz kraj, a potem zawodnika z jego składu, i zatwierdź."
          )}
        </div>
        {!readOnly && (
          <>
            <ScorerPicker value={scorer} disabled={false} onSelect={(n) => { setScorer(n); commitScorer(n); }} />
            {scorer && (
              <button className="btn btn-primary sc-confirm" disabled={confirming} onClick={confirmScorer}>
                {confirming ? "Zatwierdzanie…" : <>{I.check} Zatwierdź wybór</>}
              </button>
            )}
          </>
        )}
        {settings?.top_scorer_result && (
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)" }}>
            Oficjalny król strzelców: <b style={{ color: "var(--text)" }}>{settings.top_scorer_result}</b>
          </div>
        )}
      </div>

      <ScorersTable scorers={scorers} syncedAt={settings?.scorers_synced_at ?? null} />
    </div>
  );
}

// Licznik do zamknięcia typów specjalnych (pierwszy gwizdek − 60 s) — styl jak deadline meczów.
function LockCountdown({ now, lockAt }: { now: number; lockAt: number }) {
  const left = lockAt - now;
  return (
    <div className={`bet-deadline ${left > 0 && left < 6 * 3600000 ? "urgent" : ""}`}>
      <span className="lab">Zamknięcie typów:</span>
      <span className="clock">{fmtCountdown(left)}</span>
    </div>
  );
}

function ScorersTable({ scorers, syncedAt }: { scorers: Scorer[]; syncedAt: string | null }) {
  return (
    <div className="panel scorers-panel">
      <div className="panel-head">{I.ball}<h3>Klasyfikacja strzelców</h3><span className="ph-meta">football-data.org</span></div>
      {scorers.length === 0 ? (
        <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>
          Brak danych — klasyfikacja pojawi się po pierwszych bramkach turnieju (dane z darmowego API bywają opóźnione).
        </div>
      ) : (
        <>
          <div className="scorers-row head">
            <span className="sc-rank">#</span>
            <span className="sc-name">Zawodnik</span>
            <span className="sc-team">Drużyna</span>
            <span className="sc-num">Gole</span>
            <span className="sc-num">Asysty</span>
          </div>
          {scorers.map((s, i) => (
            <div key={s.player_name} className={`scorers-row ${i === 0 ? "lead" : ""}`}>
              <span className="sc-rank">{s.rank ?? i + 1}</span>
              <span className="sc-name">{s.player_name}</span>
              <span className="sc-team"><Flag name={s.team} ph="" /> {s.team ?? "—"}</span>
              <span className="sc-num goals">{s.goals}</span>
              <span className="sc-num">{s.assists ?? "—"}</span>
            </div>
          ))}
        </>
      )}
      <div className="scorers-foot">
        Dane z darmowego API (czołówka, z opóźnieniem).
        {syncedAt && <> Aktualizacja: <b>{fmtDateTime(syncedAt)}</b>.</>}
      </div>
    </div>
  );
}
