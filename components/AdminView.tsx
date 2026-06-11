"use client";

import { useMemo, useState, useTransition } from "react";
import type { Match, Settings, Scorer } from "@/lib/types";
import { TEAMS } from "@/lib/teams";
import { refLabel } from "@/lib/bracket";
import { fmtDateTime } from "@/lib/ui";
import { adminSetResult, adminSetBonusResult, adminSetSlot, adminClearSlot } from "@/app/actions";
import { I } from "./icons";

const FLAG_BY_NAME: Record<string, string> = Object.fromEntries(TEAMS.map((t) => [t.name, t.flag]));

export default function AdminView({
  matches,
  settings,
  scorers = [],
  onChange,
}: {
  matches: Match[];
  settings: Settings | null;
  scorers?: Scorer[];
  onChange: () => void;
}) {
  const [filter, setFilter] = useState("");
  const list = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return matches.filter((m) => !f || m.team1.toLowerCase().includes(f) || m.team2.toLowerCase().includes(f));
  }, [matches, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 760 }}>
      <div className="panel">
        <div className="panel-head">{I.info}<h3>Backup danych</h3><span className="ph-meta">typy · bonusy · wyniki</span></div>
        <div style={{ padding: 18, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <a href="/api/admin/export" className="btn btn-primary" style={{ flex: "0 0 auto", padding: "11px 18px", textDecoration: "none" }}>
            {I.check} Pobierz backup (Excel)
          </a>
          <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, flex: 1, minWidth: 220 }}>
            Pobiera plik <b style={{ color: "var(--text)" }}>.xlsx</b> ze wszystkimi typami, bonusami, rankingiem i wynikami. Rób to co jakiś czas dla spokoju — dane i tak żyją w bazie Supabase, niezależnie od aplikacji.
          </span>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">{I.cup}<h3>Wynik bonusów</h3><span className="ph-meta">rozliczane na koniec</span></div>
        <div style={{ padding: 18 }}>
          <BonusResultForm settings={settings} scorers={scorers} onChange={onChange} />
        </div>
      </div>

      <KnockoutAdmin matches={matches} onChange={onChange} />

      <div className="panel">
        <div className="panel-head">
          {I.cog}<h3>Korekta wyników</h3>
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Szukaj drużyny…"
            style={{ marginLeft: "auto", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "var(--rad-sm)", padding: "6px 11px", color: "var(--text)", fontSize: 12, outline: "none" }} />
        </div>
        <div style={{ maxHeight: "62vh", overflowY: "auto" }}>
          {list.map((m) => <AdminMatchRow key={m.id} match={m} onChange={onChange} />)}
        </div>
      </div>
    </div>
  );
}

function BonusResultForm({ settings, scorers, onChange }: { settings: Settings | null; scorers: Scorer[]; onChange: () => void }) {
  const [champ, setChamp] = useState(settings?.champion_result ?? "");
  const [scorer, setScorer] = useState(settings?.top_scorer_result ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  // Remisujący liderzy (do szybkiego wyboru gdy auto oznaczyło rewizję).
  const tied = useMemo(() => {
    if (scorers.length === 0) return [];
    const max = Math.max(...scorers.map((s) => s.goals));
    return scorers.filter((s) => s.goals === max);
  }, [scorers]);

  const review = settings?.top_scorer_review === true;
  const source = settings?.top_scorer_source;

  function save() {
    startTransition(async () => {
      const res = await adminSetBonusResult(champ, scorer);
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); onChange(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {review && (
        <div className="bonus-review">
          <b>Remis na 1. miejscu w klasyfikacji strzelców</b> — auto-logika nie rozstrzygnęła króla strzelców.
          Wybierz zwycięzcę ręcznie (ustawisz go jako oficjalnego, z priorytetem nad auto):
          {tied.length > 0 && (
            <div className="bonus-tied">
              {tied.map((s) => (
                <button key={s.player_name} type="button" className="scorer-chip" onClick={() => setScorer(s.player_name)}>
                  {s.player_name} <b>({s.goals})</b>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {source && !review && (
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Król strzelców ustawiony {source === "admin" ? "ręcznie (priorytet)" : "automatycznie z API"}.
        </div>
      )}
      <select value={champ} onChange={(e) => setChamp(e.target.value)} className="scorer-input">
        <option value="">— mistrz świata —</option>
        {TEAMS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
      </select>
      <input value={scorer} onChange={(e) => setScorer(e.target.value)} placeholder="król strzelców" className="scorer-input" />
      <button className="btn btn-primary" disabled={pending} onClick={save} style={{ flex: "0 0 auto", alignSelf: "flex-start", padding: "10px 18px" }}>
        {saved ? <>Zapisano {I.check}</> : "Zapisz bonus"}
      </button>
    </div>
  );
}

function KnockoutAdmin({ matches, onChange }: { matches: Match[]; onChange: () => void }) {
  const ko = useMemo(
    () => matches.filter((m) => m.stage !== "group").sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff)),
    [matches]
  );
  if (ko.length === 0) return null;

  return (
    <div className="panel">
      <div className="panel-head">{I.flow}<h3>Obsada drabinki</h3><span className="ph-meta">ręcznie nadpisuje auto-obsadę</span></div>
      <div style={{ padding: "6px 0", maxHeight: "62vh", overflowY: "auto" }}>
        <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5, padding: "6px 16px 12px" }}>
          Wskaż drużynę w slocie, gdy auto-logika nie rozstrzygnęła pary (remis w grupie, najlepsze 3. miejsca, dogrywka/karne).
          Ustawiony ręcznie slot jest <b style={{ color: "var(--text)" }}>zablokowany</b> — auto go nie nadpisze. „Auto" przywraca automatyczną obsadę.
        </div>
        {ko.map((m) => (
          <div key={m.id} className="admin-row" style={{ flexWrap: "wrap", gap: 8 }}>
            <span className="admin-when" style={{ minWidth: 96 }}>{m.bracket_code} · {fmtDateTime(m.kickoff)}</span>
            <SlotEditor match={m} side="home" onChange={onChange} />
            <span style={{ color: "var(--faint)" }}>–</span>
            <SlotEditor match={m} side="away" onChange={onChange} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SlotEditor({ match, side, onChange }: { match: Match; side: "home" | "away"; onChange: () => void }) {
  const team = side === "home" ? match.team1 : match.team2;
  const ref = side === "home" ? match.home_ref : match.away_ref;
  const locked = side === "home" ? match.home_locked : match.away_locked;
  const known = !!team && team !== "TBD";
  const [pending, startTransition] = useTransition();

  function set(name: string) {
    if (!name) return;
    startTransition(async () => {
      const res = await adminSetSlot(match.id, side, name, FLAG_BY_NAME[name] ?? null);
      if (res.ok) onChange();
    });
  }
  function clear() {
    startTransition(async () => {
      const res = await adminClearSlot(match.id, side);
      if (res.ok) onChange();
    });
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <select
        value={known ? (team as string) : ""}
        disabled={pending}
        onChange={(e) => set(e.target.value)}
        title={ref ? refLabel(ref) : undefined}
        style={{ background: "var(--surface-2)", border: `1px solid ${locked ? "var(--accent)" : "var(--border)"}`, borderRadius: "var(--rad-sm)", padding: "5px 8px", color: known ? "var(--text)" : "var(--muted)", fontSize: 12, maxWidth: 150, outline: "none" }}
      >
        <option value="">{ref ? refLabel(ref) : "—"}</option>
        {TEAMS.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
      </select>
      {locked && (
        <button onClick={clear} disabled={pending} title="Przywróć auto-obsadę"
          style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--muted)", background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 20, padding: "3px 8px", cursor: "pointer" }}>
          auto
        </button>
      )}
    </span>
  );
}

function AdminMatchRow({ match, onChange }: { match: Match; onChange: () => void }) {
  const [s1, setS1] = useState(match.score1?.toString() ?? "");
  const [s2, setS2] = useState(match.score2?.toString() ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      const v1 = s1 === "" ? null : parseInt(s1, 10);
      const v2 = s2 === "" ? null : parseInt(s2, 10);
      const res = await adminSetResult(match.id, v1, v2, "FINISHED");
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1200); onChange(); }
    });
  }

  return (
    <div className="admin-row">
      <span className="admin-when">{fmtDateTime(match.kickoff)}</span>
      <span className="admin-team r">{match.team1}</span>
      <input className="admin-score" inputMode="numeric" value={s1} onChange={(e) => /^\d?\d?$/.test(e.target.value) && setS1(e.target.value)} />
      <span style={{ color: "var(--faint)" }}>:</span>
      <input className="admin-score" inputMode="numeric" value={s2} onChange={(e) => /^\d?\d?$/.test(e.target.value) && setS2(e.target.value)} />
      <span className="admin-team">{match.team2}</span>
      <span className={`admin-status ${match.status === "FINISHED" ? "fin" : ""}`}>{match.status}</span>
      <button className="admin-save" disabled={pending} onClick={save}>{saved ? "✓" : I.check}</button>
    </div>
  );
}
