"use client";

import { useMemo } from "react";
import type { Match } from "@/lib/types";
import Flag from "./Flag";

// Tabele faz grupowych liczone z wyników (tylko mecze zakończone).
// Awans: 2 najlepsze z każdej grupy (bezpośrednio) + 8 najlepszych z 3. miejsc
// (Mundial 2026: 12 grup → R32). Pola awansowe mają lekką poświatę.

const ADVANCE_THIRDS = 8; // ile najlepszych 3. miejsc awansuje

type FormResult = "W" | "D" | "L";

type TeamRow = {
  team: string;
  played: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  form: FormResult[]; // chronologicznie (najstarszy → najnowszy)
};

type GroupTable = { label: string; rows: TeamRow[] };

function isFinished(m: Match): boolean {
  return m.status === "FINISHED" && m.score1 != null && m.score2 != null;
}

// Kolejność: punkty → różnica bramek → bramki zdobyte → nazwa (PL).
function cmpRows(a: TeamRow, b: TeamRow): number {
  return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team, "pl");
}

function buildTables(matches: Match[]): GroupTable[] {
  const groups = new Map<string, Map<string, TeamRow>>();

  const ensure = (label: string, team: string): TeamRow => {
    let g = groups.get(label);
    if (!g) { g = new Map(); groups.set(label, g); }
    let r = g.get(team);
    if (!r) {
      r = { team, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, form: [] };
      g.set(team, r);
    }
    return r;
  };

  // Najpierw zarejestruj wszystkie drużyny (także z meczów jeszcze nierozegranych),
  // żeby tabela pokazywała pełną grupę od początku turnieju.
  const groupMatches = matches
    .filter((m) => m.stage === "group" && m.group_label)
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));

  for (const m of groupMatches) {
    ensure(m.group_label!, m.team1);
    ensure(m.group_label!, m.team2);
  }

  for (const m of groupMatches) {
    if (!isFinished(m)) continue;
    const s1 = m.score1 as number, s2 = m.score2 as number;
    const r1 = ensure(m.group_label!, m.team1);
    const r2 = ensure(m.group_label!, m.team2);
    r1.played++; r2.played++;
    r1.gf += s1; r1.ga += s2;
    r2.gf += s2; r2.ga += s1;
    if (s1 > s2) {
      r1.w++; r1.pts += 3; r1.form.push("W");
      r2.l++; r2.form.push("L");
    } else if (s1 < s2) {
      r2.w++; r2.pts += 3; r2.form.push("W");
      r1.l++; r1.form.push("L");
    } else {
      r1.d++; r1.pts++; r1.form.push("D");
      r2.d++; r2.pts++; r2.form.push("D");
    }
  }

  const tables: GroupTable[] = [];
  groups.forEach((g, label) => {
    const rows = Array.from(g.values());
    rows.forEach((r) => { r.gd = r.gf - r.ga; });
    rows.sort(cmpRows);
    tables.push({ label, rows });
  });
  tables.sort((a, b) => a.label.localeCompare(b.label));
  return tables;
}

// Zbiór drużyn z 3. miejsc, które aktualnie łapią się do najlepszych ósemek.
function qualifyingThirds(tables: GroupTable[]): Set<string> {
  const thirds = tables
    .map((t) => t.rows[2])
    .filter((r): r is TeamRow => !!r && r.played > 0);
  thirds.sort(cmpRows);
  return new Set(thirds.slice(0, ADVANCE_THIRDS).map((r) => r.team));
}

export default function GroupTablesView({ matches }: { matches: Match[] }) {
  const tables = useMemo(() => buildTables(matches), [matches]);
  const qThirds = useMemo(() => qualifyingThirds(tables), [tables]);

  if (tables.length === 0) {
    return (
      <div className="empty-state">
        <h3>Brak tabel</h3>
        <p>Tabele pojawią się, gdy terminarz fazy grupowej zostanie wczytany.</p>
      </div>
    );
  }

  return (
    <div className="gt-view">
      <div className="gt-legend">
        <span className="gt-leg adv"><i /> Awans bezpośredni (miejsca 1–2)</span>
        <span className="gt-leg adv3"><i /> 3. miejsce z awansem (8 najlepszych)</span>
      </div>

      <div className="gt-wrap">
        {tables.map((t) => (
          <GroupTable key={t.label} table={t} qThirds={qThirds} />
        ))}
      </div>

      <p className="gt-foot">
        Tabela liczy tylko mecze zakończone. O kolejności decydują kolejno: punkty,
        różnica bramek, bramki zdobyte.
      </p>
    </div>
  );
}

function GroupTable({ table, qThirds }: { table: GroupTable; qThirds: Set<string> }) {
  return (
    <div className="panel gt-group">
      <div className="panel-head">
        <span className="gt-badge">{table.label}</span>
        <h3>Grupa {table.label}</h3>
      </div>

      <div className="gt-scroll">
        <div className="gt-table">
          <div className="gt-row head">
            <span className="gt-pos">#</span>
            <span className="gt-team">Drużyna</span>
            <span title="Rozegrane mecze">RM</span>
            <span title="Wygrane">W</span>
            <span title="Remisy">R</span>
            <span title="Porażki">P</span>
            <span title="Bramki zdobyte">BZ</span>
            <span title="Bramki stracone">BS</span>
            <span title="Różnica bramek">RB</span>
            <span className="gt-pts" title="Punkty">Pkt</span>
            <span className="gt-formhead">Ostatnie</span>
          </div>

          {table.rows.map((r, i) => {
            const rank = i + 1;
            const advCls =
              rank <= 2 ? "adv" : rank === 3 && qThirds.has(r.team) ? "adv3" : "";
            return (
              <div key={r.team} className={`gt-row ${advCls}`}>
                <span className="gt-pos">{rank}</span>
                <span className="gt-team">
                  <Flag name={r.team} />
                  <span className="gt-tname">{r.team}</span>
                </span>
                <span>{r.played}</span>
                <span>{r.w}</span>
                <span>{r.d}</span>
                <span>{r.l}</span>
                <span>{r.gf}</span>
                <span>{r.ga}</span>
                <span className={r.gd > 0 ? "gt-pos-gd" : r.gd < 0 ? "gt-neg-gd" : ""}>
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </span>
                <span className="gt-pts">{r.pts}</span>
                <span className="gt-form">
                  <FormDots form={r.form} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Forma: najnowszy wynik po lewej, do 5 ostatnich.
function FormDots({ form }: { form: FormResult[] }) {
  const last = form.slice(-5).reverse();
  if (last.length === 0) return <span className="gt-form-empty">—</span>;
  const cls = (r: FormResult) => (r === "W" ? "w" : r === "D" ? "d" : "l");
  return (
    <>
      {last.map((r, i) => (
        <span key={i} className={`gt-fc ${cls(r)}`} title={r === "W" ? "Wygrana" : r === "D" ? "Remis" : "Porażka"}>
          {r === "W" ? "W" : r === "D" ? "R" : "P"}
        </span>
      ))}
    </>
  );
}
