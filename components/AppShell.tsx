"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Match, Player, Prediction, BonusPick, Settings, StandingRow, PredMap, Scorer } from "@/lib/types";
import { isLocked, lockAtMs } from "@/lib/scoring";
import { fmtCountdown } from "@/lib/ui";
import { I, BrandCrest } from "./icons";
import Avatar from "./Avatar";
import MatchList from "./MatchList";
import KnockoutBracket from "./KnockoutBracket";
import SpecialBets from "./SpecialBets";
import ResultsView from "./ResultsView";
import BetsMatrixView from "./BetsMatrixView";
import RulesView from "./RulesView";
import AdminView from "./AdminView";
import ProfileView from "./ProfileView";
import PredictionModal from "./PredictionModal";

type View = "group" | "bracket" | "champion" | "scorer" | "results" | "bets" | "rules" | "admin" | "profile";

const TITLES: Record<View, [string, string]> = {
  results: ["Wyniki & ranking", ""],
  bets: ["Typy kawalerów", ""],
  group: ["Faza grupowa", ""],
  bracket: ["Faza pucharowa", ""],
  champion: ["Mistrz świata", ""],
  scorer: ["Król strzelców", ""],
  rules: ["Zasady", ""],
  admin: ["Panel admina", ""],
  profile: ["Mój profil", ""],
};

type PlayerLite = { id: string; name: string; avatar_url: string | null };
type BetStatusRow = { player_id: string; match_id: number };
type VisiblePredRow = { player_id: string; match_id: number; pred1: number; pred2: number };

function betKey(playerId: string, matchId: number): string {
  return `${playerId}|${matchId}`;
}
function statusSetFrom(rows: BetStatusRow[]): Set<string> {
  return new Set(rows.map((r) => betKey(r.player_id, r.match_id)));
}
function predMapFrom(rows: VisiblePredRow[]): Map<string, { pred1: number; pred2: number }> {
  return new Map(rows.map((r) => [betKey(r.player_id, r.match_id), { pred1: r.pred1, pred2: r.pred2 }]));
}

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
  me: initialMe,
  matches: initialMatches,
  initialPreds,
  initialBonus,
  settings: initialSettings,
  initialStandings,
  initialAvatars,
  players,
  initialBetStatus,
  initialVisiblePreds,
  initialScorers,
}: {
  me: Player;
  matches: Match[];
  initialPreds: Prediction[];
  initialBonus: BonusPick | null;
  settings: Settings | null;
  initialStandings: StandingRow[];
  initialAvatars: Record<string, string | null>;
  players: PlayerLite[];
  initialBetStatus: BetStatusRow[];
  initialVisiblePreds: VisiblePredRow[];
  initialScorers: Scorer[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [me, setMe] = useState<Player>(initialMe);
  const [avatars, setAvatars] = useState<Record<string, string | null>>(initialAvatars);
  const [betStatus, setBetStatus] = useState<Set<string>>(() => statusSetFrom(initialBetStatus));
  const [betPreds, setBetPreds] = useState<Map<string, { pred1: number; pred2: number }>>(() => predMapFrom(initialVisiblePreds));
  const [view, setView] = useState<View>("results");
  const [now, setNow] = useState(() => Date.now());
  const [mounted, setMounted] = useState(false);
  const [matches, setMatches] = useState(initialMatches);
  const [settings, setSettings] = useState(initialSettings);
  const [standings, setStandings] = useState(initialStandings);
  const [scorers, setScorers] = useState<Scorer[]>(initialScorers);
  const [modalMatch, setModalMatch] = useState<Match | null>(null);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [navOpen, setNavOpen] = useState(false);

  const [preds, setPreds] = useState<PredMap>(() => {
    const m: PredMap = {};
    for (const p of initialPreds) m[p.match_id] = { pred1: p.pred1, pred2: p.pred2 };
    return m;
  });
  const [bonus, setBonus] = useState<BonusPick>(
    initialBonus ?? { player_id: me.id, champion: null, top_scorer: null, champion_locked: false, top_scorer_locked: false }
  );

  useEffect(() => {
    setMounted(true);
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const showToast = useCallback((msg: string, err = false) => {
    setToast({ msg, err });
    window.clearTimeout((window as any).__tt);
    (window as any).__tt = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const onAvatarChange = useCallback((url: string | null) => {
    setMe((m) => ({ ...m, avatar_url: url }));
    setAvatars((a) => ({ ...a, [me.id]: url }));
  }, [me.id]);
  const onNameChange = useCallback((name: string) => {
    setMe((m) => ({ ...m, name }));
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
  const refetchScorers = useCallback(async () => {
    const { data } = await supabase.from("scorers").select("*").order("rank", { ascending: true });
    if (data) setScorers(data as Scorer[]);
  }, [supabase]);
  // Status "obstawił/nie" (RPC presence-only) + widoczne wartości typów (RLS-gated).
  const refetchBets = useCallback(async () => {
    const [s, v] = await Promise.all([
      supabase.rpc("get_prediction_status"),
      supabase.from("predictions").select("player_id, match_id, pred1, pred2"),
    ]);
    if (s.data) setBetStatus(statusSetFrom(s.data as BetStatusRow[]));
    if (v.data) setBetPreds(predMapFrom(v.data as VisiblePredRow[]));
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
      .on("postgres_changes", { event: "*", schema: "public", table: "predictions" }, () => { refetchStandings(); refetchBets(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "bonus_picks" }, refetchStandings)
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, () => { refetchSettings(); refetchStandings(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "scorers" }, refetchScorers)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, refetchMatches, refetchStandings, refetchSettings, refetchBets, refetchScorers]);

  // Widok "Typy kawalerów": realtime predictions jest filtrowane przez RLS (cudze
  // wstawienia otwartych meczów nie dochodzą), więc odświeżamy status pollingiem.
  useEffect(() => {
    if (view !== "bets") return;
    refetchBets();
    const id = setInterval(refetchBets, 20000);
    return () => clearInterval(id);
  }, [view, refetchBets]);

  // Widok "Wyniki": gdy trwa mecz (okno czasowe), dociągaj wyniki z bazy co 60 s
  // (siatka bezpieczeństwa obok realtime; czyta tylko Supabase, nie rusza limitu API).
  const matchesRef = useRef(matches);
  matchesRef.current = matches;
  useEffect(() => {
    if (view !== "results") return;
    const id = setInterval(() => {
      const t = Date.now();
      const anyInWindow = matchesRef.current.some((m) => {
        const k = +new Date(m.kickoff);
        return t >= k && t < k + 130 * 60 * 1000;
      });
      if (anyInWindow) { refetchMatches(); refetchStandings(); }
    }, 60000);
    return () => clearInterval(id);
  }, [view, refetchMatches, refetchStandings]);

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
    refetchBets(); // odśwież widok "Typy kawalerów" od razu
  }

  const goto = (v: View) => { setView(v); setNavOpen(false); };

  // jakikolwiek mecz na żywo -> badge LIVE przy Fazie grupowej
  const anyLive = useMemo(
    () => matches.some((m) => m.status === "IN_PLAY" || m.status === "PAUSED"),
    [matches]
  );

  // licznik rozegranych meczów grupowych (np. 5/72)
  const groupCount = useMemo(() => {
    const g = matches.filter((m) => m.stage === "group");
    return { done: g.filter((m) => m.status === "FINISHED").length, total: g.length };
  }, [matches]);

  // gracze z aktualnym awatarem (mapa avatars aktualizuje się po zmianie własnego)
  const playersLive = useMemo(
    () => players.map((p) => ({ ...p, avatar_url: avatars[p.id] ?? p.avatar_url })),
    [players, avatars]
  );

  const NAV: { key: View; label: string; icon: keyof typeof I }[] = [
    { key: "results", label: "Wyniki i ranking", icon: "trophy" },
    { key: "bets", label: "Typy kawalerów", icon: "list" },
    { key: "group", label: "Faza grupowa", icon: "grid" },
    { key: "bracket", label: "Faza pucharowa", icon: "flow" },
    { key: "champion", label: "Mistrz świata", icon: "cup" },
    { key: "scorer", label: "Król strzelców", icon: "ball" },
    { key: "rules", label: "Zasady", icon: "info" },
    { key: "profile", label: "Mój profil", icon: "people" },
  ];
  if (me.is_admin) NAV.push({ key: "admin", label: "Panel admina", icon: "cog" });

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
          {NAV.map((it) => (
            <button key={it.key} className={`nav-item ${view === it.key ? "active" : ""}`} onClick={() => goto(it.key)}>
              {I[it.icon]}
              <span>{it.label}</span>
              <span className="nav-meta">
                {it.key === "group" && anyLive && <span className="nav-badge live">LIVE</span>}
                {it.key === "results" && myIdx >= 0 && <span className="nav-badge">#{myRank}</span>}
              </span>
            </button>
          ))}
        </nav>

      </aside>

      <main className="main">
        <div className="topbar">
          <button className="menu-btn mobile-only" onClick={() => setNavOpen(true)} aria-label="Menu">{I.menu}</button>
          <div>
            <h1>{TITLES[view][0]}</h1>
            {view === "group" ? (
              <div className="crumb">{groupCount.done} / {groupCount.total} meczów rozegranych</div>
            ) : (
              TITLES[view][1] && <div className="crumb">{TITLES[view][1]}</div>
            )}
          </div>
          <div className="topbar-spacer" />
          {view === "group" && nextLock && (
            <div className={`deadline-pill ${mounted && nextLock - now < 6 * 3600000 ? "urgent" : ""}`}>
              <span className="lab">Najbliższe zamknięcie:</span>
              <span className="clock" suppressHydrationWarning>{mounted ? fmtCountdown(nextLock - now) : "—"}</span>
            </div>
          )}
          <button className="me-chip" onClick={() => goto("profile")} title="Mój profil">
            <span className="pts">{myPoints}<small>PKT</small></span>
            <Avatar name={me.name} seed={me.id} size={34} avatarUrl={me.avatar_url} />
          </button>
          <form action="/auth/signout" method="post">
            <button type="submit" className="logout-chip" title="Wyloguj">Wyloguj</button>
          </form>
        </div>

        <div className="content">
          {view === "group" && <MatchList matches={matches} preds={preds} now={now} onOpenMatch={openMatch} />}
          {view === "bracket" && <KnockoutBracket matches={matches} onOpenMatch={openMatch} />}
          {view === "champion" && (
            <SpecialBets mode="champion" bonus={bonus} setBonus={setBonus} settings={settings} matches={matches} now={now} onToast={showToast} />
          )}
          {view === "scorer" && (
            <SpecialBets mode="scorer" bonus={bonus} setBonus={setBonus} settings={settings} matches={matches} now={now} onToast={showToast} scorers={scorers} />
          )}
          {view === "results" && <ResultsView standings={standings} meId={me.id} matches={matches} preds={preds} avatars={avatars} now={now} />}
          {view === "bets" && (
            <BetsMatrixView matches={matches} players={playersLive} statusSet={betStatus} predValues={betPreds} meId={me.id} now={now} onOpenMatch={openMatch} />
          )}
          {view === "rules" && <RulesView />}
          {view === "profile" && (
            <ProfileView me={me} onAvatarChange={onAvatarChange} onNameChange={onNameChange} onToast={showToast} />
          )}
          {view === "admin" && me.is_admin && (
            <AdminView matches={matches} settings={settings} scorers={scorers} onChange={() => { refetchMatches(); refetchStandings(); refetchSettings(); }} />
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
