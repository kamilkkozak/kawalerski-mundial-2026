"use client";

import { useMemo, useState, useTransition } from "react";
import type { Match, Settings } from "@/lib/types";
import { TEAMS } from "@/lib/teams";
import { fmtDateTime } from "@/lib/ui";
import { adminSetResult, adminSetBonusResult } from "@/app/actions";
import { I } from "./icons";

export default function AdminView({
  matches,
  settings,
  onChange,
}: {
  matches: Match[];
  settings: Settings | null;
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
        <div className="panel-head">{I.cup}<h3>Wynik bonusów</h3><span className="ph-meta">rozliczane na koniec</span></div>
        <div style={{ padding: 18 }}>
          <BonusResultForm settings={settings} onChange={onChange} />
        </div>
      </div>

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

function BonusResultForm({ settings, onChange }: { settings: Settings | null; onChange: () => void }) {
  const [champ, setChamp] = useState(settings?.champion_result ?? "");
  const [scorer, setScorer] = useState(settings?.top_scorer_result ?? "");
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    startTransition(async () => {
      const res = await adminSetBonusResult(champ, scorer);
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 1500); onChange(); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
