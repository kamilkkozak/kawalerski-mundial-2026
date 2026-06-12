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
type PlayerLite = { id: string; name: string; avatar_url: string | null };
type BonusPickLite = { player_id: string; champion: string | null; champion_locked: boolean; top_scorer: string | null; top_scorer_locked: boolean };

export default function SpecialBets({
  mode,
  bonus,
  setBonus,
  settings,
  matches,
  now,
  onToast,
  scorers = [],
  allBonusPicks = [],
  players = [],
  meId,
}: {
  mode: "champion" | "scorer";
  bonus: BonusPick;
  setBonus: (b: BonusPick) => void;
  settings: Settings | null;
  matches: Match[];
  now: number;
  onToast: (msg: string, err?: boolean) => void;
  scorers?: Scorer[];
  allBonusPicks?: BonusPickLite[];
  players?: PlayerLite[];
  meId?: string;
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
        {!champReadOnly && (
          <div className="special-card">
            <div className="sc-sub">
              <>Wybierz reprezentację{champ ? <> — wybór: <b style={{ color: "var(--accent)" }}>{champ}</b></> : null} i zatwierdź.</>
            </div>
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
          </div>
        )}
        <ChampionPicksTable picks={allBonusPicks} players={players} meId={meId} result={settings?.champion_result ?? null} />
      </div>
    );
  }

  const confirmed = bonus.top_scorer_locked === true;
  const readOnly = locked || confirmed;

  return (
    <div>
      {!readOnly && (
        <div className="special-card">
          <div className="sc-sub">Wybierz kraj, a potem zawodnika z jego składu, i zatwierdź.</div>
          <ScorerPicker value={scorer} disabled={false} onSelect={(n) => { setScorer(n); commitScorer(n); }} />
          {scorer && (
            <button className="btn btn-primary sc-confirm" disabled={confirming} onClick={confirmScorer}>
              {confirming ? "Zatwierdzanie…" : <>{I.check} Zatwierdź wybór</>}
            </button>
          )}
        </div>
      )}

      <ScorersTable scorers={scorers} syncedAt={settings?.scorers_synced_at ?? null} />
      <ScorerPicksTable picks={allBonusPicks} players={players} meId={meId} result={settings?.top_scorer_result ?? null} />
    </div>
  );
}

function ChampionPicksTable({
  picks,
  players,
  meId,
  result,
}: {
  picks: BonusPickLite[];
  players: PlayerLite[];
  meId?: string;
  result: string | null;
}) {
  const playerMap = useMemo(() => {
    const m: Record<string, PlayerLite> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const rows = useMemo(() => {
    return picks
      .map((pick) => ({ pick, player: playerMap[pick.player_id] }))
      .filter((r) => r.player)
      .sort((a, b) => {
        if (a.pick.champion && !b.pick.champion) return -1;
        if (!a.pick.champion && b.pick.champion) return 1;
        return a.player.name.localeCompare(b.player.name, "pl");
      });
  }, [picks, playerMap]);

  if (rows.length === 0) return null;

  return (
    <div className="panel scorers-panel" style={{ marginTop: 16 }}>
      <div className="panel-head">{I.cup}<h3>Obstawienia uczestników</h3></div>
      <div style={{ display: "grid", gridTemplateColumns: "max-content auto" }}>
        {rows.map(({ pick, player }) => {
          const isMe = player.id === meId;
          const hit = result && pick.champion && pick.champion === result;
          const rowBg = isMe ? { background: "rgba(212,175,55,.13)", borderLeft: "3px solid var(--accent)" } : {};
          return [
            <span
              key={`n-${player.id}`}
              className="sc-name"
              style={{ padding: "10px 8px 10px 18px", borderBottom: "1px solid var(--border)", fontWeight: isMe ? 700 : undefined, whiteSpace: "nowrap", overflow: "visible", ...rowBg }}
            >
              {player.name}
            </span>,
            <span
              key={`t-${player.id}`}
              className="sc-team"
              style={{ padding: "10px 18px 10px 12px", borderBottom: "1px solid var(--border)", ...rowBg }}
            >
              {pick.champion ? (
                <>
                  <Flag name={pick.champion} ph="" />
                  <span style={{ color: hit ? "var(--accent)" : undefined }}>{pick.champion}</span>
                  {hit && <span style={{ marginLeft: 4, color: "var(--accent)" }}>{I.check}</span>}
                </>
              ) : (
                <span style={{ color: "var(--muted)" }}>—</span>
              )}
            </span>,
          ];
        })}
      </div>
    </div>
  );
}

function ScorerPicksTable({
  picks,
  players,
  meId,
  result,
}: {
  picks: BonusPickLite[];
  players: PlayerLite[];
  meId?: string;
  result: string | null;
}) {
  const playerMap = useMemo(() => {
    const m: Record<string, PlayerLite> = {};
    for (const p of players) m[p.id] = p;
    return m;
  }, [players]);

  const rows = useMemo(() => {
    return picks
      .map((pick) => ({ pick, player: playerMap[pick.player_id] }))
      .filter((r) => r.player)
      .sort((a, b) => {
        if (a.pick.top_scorer && !b.pick.top_scorer) return -1;
        if (!a.pick.top_scorer && b.pick.top_scorer) return 1;
        return a.player.name.localeCompare(b.player.name, "pl");
      });
  }, [picks, playerMap]);

  if (rows.length === 0) return null;

  return (
    <div className="panel scorers-panel" style={{ marginTop: 16 }}>
      <div className="panel-head">{I.ball}<h3>Obstawienia uczestników</h3></div>
      <div style={{ display: "grid", gridTemplateColumns: "max-content auto" }}>
        {rows.map(({ pick, player }) => {
          const isMe = player.id === meId;
          const hit = result && pick.top_scorer && pick.top_scorer.toLowerCase() === result.toLowerCase();
          const rowBg = isMe ? { background: "rgba(212,175,55,.13)", borderLeft: "3px solid var(--accent)" } : {};
          return [
            <span
              key={`n-${player.id}`}
              className="sc-name"
              style={{ padding: "10px 8px 10px 18px", borderBottom: "1px solid var(--border)", fontWeight: isMe ? 700 : undefined, whiteSpace: "nowrap", overflow: "visible", ...rowBg }}
            >
              {player.name}
            </span>,
            <span
              key={`t-${player.id}`}
              className="sc-team"
              style={{ padding: "10px 18px 10px 12px", borderBottom: "1px solid var(--border)", ...rowBg }}
            >
              {pick.top_scorer ? (
                <>
                  <span style={{ color: hit ? "var(--accent)" : undefined }}>{pick.top_scorer}</span>
                  {hit && <span style={{ marginLeft: 4, color: "var(--accent)" }}>{I.check}</span>}
                </>
              ) : (
                <span style={{ color: "var(--muted)" }}>—</span>
              )}
            </span>,
          ];
        })}
      </div>
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
      <div className="panel-head">{I.ball}<h3>Klasyfikacja strzelców</h3></div>
      {scorers.length === 0 ? (
        <div style={{ padding: 22, color: "var(--muted)", fontSize: 13 }}>
          Brak danych — klasyfikacja pojawi się po pierwszych bramkach turnieju (dane z darmowego API bywają opóźnione).
        </div>
      ) : (
        <>
          <div className="scorers-row head">
            <span className="sc-rank"></span>
            <span className="sc-name"></span>
            <span className="sc-team"></span>
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
      {syncedAt && <div className="scorers-foot">Aktualizacja: <b>{fmtDateTime(syncedAt)}</b>.</div>}
    </div>
  );
}
