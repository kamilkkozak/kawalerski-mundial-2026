"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Match, Player, Prediction, BonusPick, Settings, StandingRow, PredMap } from "@/lib/types";
import { isLocked, lockAtMs } from "@/lib/scoring";
import { fmtCountdown } from "@/lib/ui";
import { I, BrandCrest } from "./icons";
import Avatar from "./Avatar";
import GroupBoard from "./GroupBoard";
import MatchList from "./MatchList";
import KnockoutBracket from "./KnockoutBracket";
import SpecialBets from "./SpecialBets";
import ResultsView from "./ResultsView";
import RulesView from "./RulesView";
import AdminView from "./AdminView";
import PredictionModal from "./PredictionModal";

type View = "groups" | "group" | "bracket" | "special" | "results" | "rules" | "admin";

const TITLES: Record<View, [string, string]> = {
  groups: ["Tablica grup", "12 grup · typuj parując drużyny"],
  group: ["Faza grupowa", "72 mecze · lock 60 s przed gwizdkiem"],
  bracket: ["Drabinka turnieju", "Faza pucharowa · 1/16 → finał"],
  special: ["Typy specjalne", "Mistrz świata + król strzelców · +10 pkt"],
  results: ["Wyniki & ranking", "Klasyfikacja na żywo"],
  rules: ["Zasady", "Punktacja, deadline, pula nagród"],
  admin: ["Panel admina", "Korekta wyników + wynik bonusów"],
};

function standingsFromRpc(data: any[]): StandingRow[] {
  return (data ?? []).map((r) => ({
    player_id: r.player_id,
    name: r.name,
    points: Number(r.points),
    exact: Number(r.exact_hits),
    hits: Number(r.result_hits),
    bonus_points: Number(r.bonus_points),
  }));
}

export default function AppShell({
  me,
  matches: initialMatches,
  initialPreds,
  initialBonus,
  settings: initialSettings,
  initialStandings,
}: {
  me: Player;
  matches: Match[];
  initialPreds: Prediction[];
  initialBonus: BonusPick | null;
  settings: Settings | null;
  initialStandings: StandingRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<View>("groups");
  const [now, setNow] = useState(() => Date.now());
  const [matches, setMatches] = useState(initialMatches);
  const [settings, setSettings] = useState(initialSettings);
  const [standings, setStandings] = useState(initialStandings);
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const [preds, setPreds] = useState<PredMap>(() => {
    const m: PredMap = {};
    for (const p of initialPreds) m[p.match_id] = { pred1: p.pred1, pred2: p.pred2 };
    return m;
  });
  const [bonus, setBonus] = useState<BonusPick>(
    initialBonus ?? { player_id: me.id, champion: null, top_scorer: null }
  );

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    window.clearTimeout((window as any).__tt);
    (window as any).__tt = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const refetchMatches = useCallback(async () => {
    const { data } = await supabase.from("matches").select("*").order("kickoff", { ascending: true });
    if (data) setMatches(data as Match[]);
  }, [supabase]);
  const refetchStandings = useCallback(async () => {
    const { data } = await supabase.rpc("get_standings");
    if (data) setStandings(standingsFromRpc(data as any[]));
  }, [supabase]);
  const refetchSettings = useCallback(async () => {
    const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
    if (data) setSettings(data as Settings);
  }, [supabase]);

  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const debounced = () => {
      if (debTimer.current) clearTimeout(debTimer.current);
      debTimer.current = setTimeout(() => { refetchStandings(); refetchMatches(); }, 400);
    };
    const channel = supabase
      .channel("mundial-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, debounced)
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, refetchStandings)
      .on("postgres_changes", { event: "*", schema: "public", table: "bonus_picks" }, refetchStandings)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => { refetchSettings(); refetchStandings(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, refetchMatches, refetchStandings, refetchSettings]);

  // moje miejsce + punkty z rankingu
  const myIdx = standings.findIndex((s) => s.player_id === me.id);
  const myPoints = myIdx >= 0 ? standings[myIdx].points : 0;
  const myRank = myIdx >= 0 ? myIdx + 1 : standings.length + 1;

  // najbliższe zamknięcie typu (faza grupowa)
  const nextLock = useMemo(() => {
    const open = matches
      .filter((m) => m.stage === "group" && !isLocked(m.kickoff, now))
      .map((m) => lockAtMs(m.kickoff));
    return open.length ? Math.min(...open) : null;
  }, [matches, now]);

  function openMatch(m: Match) {
    setModalMatch(m);
  }
  function onSaved(matchId: number, p1: number, p2: number) {
    setPreds((prev) => ({ ...prev, [matchId]: { pred1: p1, pred2: p2 } }));
    setModalMatch(null);
    showToast("Typ zapisany");
  }

  const goto = (v: View) => { setView(v); setNavOpen(false); };

  const NAV: { sec: string; items: { key: View; label: string; icon: keyof typeof I; date?: string; live?: boolean }[] }[] = [
    { sec: "TYPOWANIE", items: [
      { key: "groups", label: "Grupy", icon: "grid" },
      { key: "group", label: "Faza grupowa", icon: "cal", date: "11–28 cze" },
    ]},
    { sec: "FAZA PUCHAROWA", items: [
      { key: "bracket", label: "Drabinka turnieju", icon: "flow", date: "29 cze – 19 lip" },
    ]},
    { sec: "EKSTRA", items: [
      { key: "special", label: "Mistrz & król strzelców", icon: "star" },
      { key: "results", label: "Wyniki & ranking", icon: "trophy" },
      { key: "rules", label: "Zasady", icon: "info" },
    ]},
  ];
  if (me.is_admin) NAV.push({ sec: "ADMIN", items: [{ key: "admin", label: "Panel admina", icon: "cog" }] });

  return (
    <div className="app">
      <div className={`sidebar-scrim ${navOpen ? "show" : ""}`} onClick={() => setNavOpen(false)} />

      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <span className="brand-crest"><BrandCrest size={46} /></span>
            <div className="brand-name">Kawalerski<b>Mundial 2026</b></div>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((group) => (
            <div key={group.sec}>
              <div className="nav-label">{group.sec}</div>
              {group.items.map((it) => (
                <button key={it.key} className={`nav-item ${view === it.key ? "active" : ""}`} onClick={() => goto(it.key)}>
                  {I[it.icon]}
                  <span>{it.label}</span>
                  <span className="nav-meta">
                    {it.date && <span className="nav-date">{it.date}</span>}
                    {it.key === "results" && myIdx >= 0 && <span className="nav-badge">#{myRank}</span>}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="pot-card">
            <div className="pot-row"><span className="k">Twoja pozycja</span><span className="v accent">#{myRank} / {standings.length}</span></div>
            <div className="pot-row"><span className="k">Twoje punkty</span><span className="v">{myPoints} pkt</span></div>
            <div className="pot-row"><span className="k">Nagrody</span><span className="v">250 / 125 / 75</span></div>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="signout-btn">Wyloguj ({me.name})</button>
          </form>
        </div>
      </aside>

      <main className="main">
        <div className="topbar">
          <button className="menu-btn mobile-only" onClick={() => setNavOpen(true)} aria-label="Menu">{I.menu}</button>
          <div>
            <h1>{TITLES[view][0]}</h1>
            <div className="crumb">{TITLES[view][1]}</div>
          </div>
          <div className="topbar-spacer" />
          {(view === "groups" || view === "group") && nextLock && (
            <div className={`deadline-pill ${nextLock - now < 6 * 3600000 ? "urgent" : ""}`}>
              <span className="lab">Najbliższe zamknięcie:</span>
              <span className="clock">{fmtCountdown(nextLock - now)}</span>
            </div>
          )}
          <div className="me-chip">
            <span className="pts">{myPoints}<small>PKT</small></span>
            <Avatar name={me.name} seed={me.id} size={34} />
          </div>
        </div>

        <div className="content">
          {view === "groups" && <GroupBoard matches={matches} preds={preds} now={now} onOpenMatch={openMatch} />}
          {view === "group" && <MatchList matches={matches} preds={preds} now={now} onOpenMatch={openMatch} />}
          {view === "bracket" && <KnockoutBracket matches={matches} />}
          {view === "special" && (
            <SpecialBets bonus={bonus} setBonus={setBonus} settings={settings} matches={matches} now={now} onToast={showToast} />
          )}
          {view === "results" && <ResultsView standings={standings} meId={me.id} matches={matches} preds={preds} />}
          {view === "rules" && <RulesView />}
          {view === "admin" && me.is_admin && (
            <AdminView matches={matches} settings={settings} onChange={() => { refetchMatches(); refetchStandings(); refetchSettings(); }} />
          )}
        </div>
      </main>

      {modalMatch && (
        <PredictionModal
          match={modalMatch}
          pred={preds[modalMatch.id]}
          now={now}
          onSaved={onSaved}
          onClose={() => setModalMatch(null)}
        />
      )}

      {toast && <div className={`toast ${toast.err ? "err" : ""}`}>{I.check} {toast.msg}</div>}
    </div>
  );
}
