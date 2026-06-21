"use client";

import { useMemo } from "react";
import type { Match } from "@/lib/types";
import Flag from "./Flag";

// Tabele faz grupowych liczone z wyników (tylko mecze zakończone).
// Awans: 2 najlepsze z każdej grupy (bezpośrednio) + 8 najlepszych z 3. miejsc
// (Mundial 2026: 12 grup → R32). Pola awansowe mają lekką poświatę.

const ADVANCE_THIRDS = 8; // ile najlepszych 3. miejsc awansuje

type Cell = "W" | "D" | "L" | "S"; // S = mecz zaplanowany (jeszcze nierozegrany)

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
  cells: Cell[]; // wszystkie mecze grupowe chronologicznie (najstarszy → najnowszy), wliczając zaplanowane
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
      r = { team, played: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0, cells: [] };
      g.set(team, r);
    }
    return r;
  };

  // Wszystkie mecze grupowe w kolejności rozegrania — także te jeszcze nierozegrane,
  // żeby tabela i pasek "Mecze" pokazywały pełną grupę od początku turnieju.
  const groupMatches = matches
    .filter((m) => m.stage === "group" && m.group_label)
    .sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));

  // Jeden przebieg: rejestruje drużyny, liczy statystyki meczów zakończonych
  // i dopisuje komórkę paska "Mecze" (mecz zaplanowany = "S").
  for (const m of groupMatches) {
    const r1 = ensure(m.group_label!, m.team1);
    const r2 = ensure(m.group_label!, m.team2);
    if (!isFinished(m)) {
      r1.cells.push("S");
      r2.cells.push("S");
      continue;
    }
    const s1 = m.score1 as number, s2 = m.score2 as number;
    r1.played++; r2.played++;
    r1.gf += s1; r1.ga += s2;
    r2.gf += s2; r2.ga += s1;
    if (s1 > s2) {
      r1.w++; r1.pts += 3; r1.cells.push("W");
      r2.l++; r2.cells.push("L");
    } else if (s1 < s2) {
      r2.w++; r2.pts += 3; r2.cells.push("W");
      r1.l++; r1.cells.push("L");
    } else {
      r1.d++; r1.pts++; r1.cells.push("D");
      r2.d++; r2.pts++; r2.cells.push("D");
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
            <span className="gt-formhead">Mecze</span>
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
                  <MatchDots cells={r.cells} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Pasek meczów grupowych: chronologicznie (najstarszy po lewej), wliczając mecze
// zaplanowane (puste, szare). Każda drużyna gra 3 mecze w grupie.
function MatchDots({ cells }: { cells: Cell[] }) {
  if (cells.length === 0) return <span className="gt-form-empty">—</span>;
  const meta = (c: Cell) =>
    c === "W" ? { cls: "w", txt: "W", title: "Wygrana" }
    : c === "D" ? { cls: "d", txt: "R", title: "Remis" }
    : c === "L" ? { cls: "l", txt: "P", title: "Porażka" }
    : { cls: "s", txt: "", title: "Mecz zaplanowany" };
  return (
    <>
      {cells.map((c, i) => {
        const m = meta(c);
        return (
          <span key={i} className={`gt-fc ${m.cls}`} title={m.title}>
            {m.txt}
          </span>
        );
      })}
    </>
  );
}
