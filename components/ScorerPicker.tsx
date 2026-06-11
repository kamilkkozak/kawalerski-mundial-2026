"use client";

import { useEffect, useMemo, useState } from "react";
import { loadSquads, normName, POS_ORDER, POS_LABEL, type Squad } from "@/lib/squads";
import Flag from "./Flag";

// Dwustopniowy wybór króla strzelców: kraj -> zawodnik (grupowany po pozycji).
// Zapisuje kanoniczne nazwisko przez onSelect (spójne z dopasowaniem /scorers).
export default function ScorerPicker({
  value,
  disabled,
  onSelect,
}: {
  value: string;
  disabled?: boolean;
  onSelect: (name: string) => void;
}) {
  const [squads, setSquads] = useState<Squad[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState("");

  useEffect(() => {
    let alive = true;
    loadSquads().then(
      (s) => alive && setSquads(s),
      () => alive && setErr("Nie udało się wczytać składów. Możesz wpisać nazwisko ręcznie.")
    );
    return () => { alive = false; };
  }, []);

  // kraj wybranego zawodnika (dla podglądu)
  const pickedTeam = useMemo(() => {
    if (!value || !squads) return null;
    const nv = normName(value);
    for (const t of squads) if (t.players.some((p) => normName(p.name) === nv)) return t.team;
    return null;
  }, [value, squads]);

  const q = normName(search);
  const searchResults = useMemo(() => {
    if (!squads || q.length < 2) return [];
    const out: { name: string; team: string; club: string }[] = [];
    for (const t of squads) {
      for (const p of t.players) {
        if (normName(p.name).includes(q)) out.push({ name: p.name, team: t.team, club: p.club });
        if (out.length >= 40) return out;
      }
    }
    return out;
  }, [squads, q]);

  const selectedSquad = useMemo(
    () => (country && squads ? squads.find((t) => t.team === country) ?? null : null),
    [country, squads]
  );

  function pick(name: string) {
    if (disabled) return;
    onSelect(name);
  }

  return (
    <div className="sp">
      <div className="sp-current">
        {value ? (
          <>Wybrany typ: <b>{value}</b>{pickedTeam ? <span className="sp-cur-team"><Flag name={pickedTeam} ph="" /> {pickedTeam}</span> : null}</>
        ) : (
          <span className="sp-cur-empty">Nie wybrano jeszcze króla strzelców.</span>
        )}
      </div>

      {!disabled && (
        <>
          <input
            className="sp-search"
            value={search}
            placeholder="Szukaj po nazwisku (np. mbappe)…"
            onChange={(e) => setSearch(e.target.value)}
          />

          {err && <div className="sp-err">{err}</div>}

          {/* Wyniki wyszukiwania (mają priorytet nad ścieżką kraj->zawodnik) */}
          {q.length >= 2 ? (
            <div className="sp-list">
              {searchResults.length === 0 && <div className="sp-empty">Brak zawodników dla „{search}".</div>}
              {searchResults.map((r) => (
                <button key={`${r.team}-${r.name}`} className={`sp-result ${normName(r.name) === normName(value) ? "sel" : ""}`} onClick={() => pick(r.name)}>
                  <Flag name={r.team} ph="" />
                  <span className="sp-rname">{r.name}</span>
                  <span className="sp-rmeta">{r.team} · {r.club}</span>
                </button>
              ))}
            </div>
          ) : !squads ? (
            <div className="sp-empty">Wczytywanie składów…</div>
          ) : !country ? (
            /* Krok 1: wybór kraju */
            <div className="sp-countries">
              {squads.map((t) => (
                <button key={t.team} className="sp-country" onClick={() => setCountry(t.team)}>
                  <Flag name={t.team} ph="" />
                  <span>{t.team}</span>
                </button>
              ))}
            </div>
          ) : (
            /* Krok 2: zawodnicy kraju, grupowani po pozycji */
            <div className="sp-squad">
              <div className="sp-squad-head">
                <button className="sp-back" onClick={() => setCountry(null)}>← Zmień kraj</button>
                <span className="sp-squad-team"><Flag name={country} ph="" /> {country}</span>
              </div>
              {selectedSquad && POS_ORDER.map((pos) => {
                const group = selectedSquad.players.filter((p) => p.pos === pos);
                if (group.length === 0) return null;
                return (
                  <div key={pos} className="sp-group">
                    <div className="sp-group-label">{POS_LABEL[pos]}</div>
                    <div className="sp-list">
                      {group.map((p) => (
                        <button key={p.name} className={`sp-player ${normName(p.name) === normName(value) ? "sel" : ""}`} onClick={() => pick(p.name)}>
                          <span className="sp-pname">{p.name}</span>
                          <span className="sp-pclub">{p.club}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Fallback: wpisz ręcznie */}
          <details className="sp-manual">
            <summary>Nie ma go na liście? Wpisz ręcznie</summary>
            <div className="sp-manual-row">
              <input
                className="sp-search"
                value={manual}
                placeholder="np. Jan Kowalski"
                onChange={(e) => setManual(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && manual.trim()) pick(manual.trim()); }}
              />
              <button className="btn btn-ghost" disabled={!manual.trim()} onClick={() => pick(manual.trim())}>Ustaw</button>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
