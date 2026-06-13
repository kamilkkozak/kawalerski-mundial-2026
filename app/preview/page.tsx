"use client";

// TYMCZASOWA strona podglądu kart meczów (demo wiersza venue/frekwencji).
// Niezależna od logowania i bazy — dane wstrzyknięte na sztywno. Usunąć po demie.

import MatchCard from "@/components/MatchCard";
import KnockoutBracket from "@/components/KnockoutBracket";
import { BRACKET } from "@/lib/bracket";
import type { Match } from "@/lib/types";

// Stały znacznik czasu (NIE Date.now()) — inaczej render serwerowy i hydracja w przeglądarce
// dają inne wartości i React zgłasza mismatch. To tylko strona demo.
const now = 1782648360000; // ~2026-06-28 12:06 UTC
const hour = 3600_000;

const base = {
  ext_id: null,
  stage: "group" as const,
  group_label: "A",
  flag1: null,
  flag2: null,
  bracket_code: null,
  home_ref: null,
  away_ref: null,
  home_locked: false,
  away_locked: false,
  updated_at: new Date(now).toISOString(),
};

const matches: Match[] = [
  {
    ...base,
    id: 1,
    kickoff: new Date(now + 6 * hour).toISOString(),
    team1: "Meksyk",
    team2: "RPA",
    venue: "Mexico City",
    score1: null,
    score2: null,
    attendance: null,
    status: "SCHEDULED",
  },
  {
    ...base,
    id: 2,
    group_label: "L",
    kickoff: new Date(now - 2 * hour).toISOString(),
    team1: "Anglia",
    team2: "Chorwacja",
    venue: "Dallas",
    score1: 2,
    score2: 1,
    attendance: 92611,
    status: "FINISHED",
  },
  {
    ...base,
    id: 3,
    group_label: "C",
    kickoff: new Date(now - 30 * 60_000).toISOString(),
    team1: "Brazylia",
    team2: "Maroko",
    venue: "New York/NJ",
    score1: 1,
    score2: 0,
    attendance: null,
    status: "IN_PLAY",
  },
  {
    ...base,
    id: 4,
    group_label: "H",
    kickoff: new Date(now - 5 * hour).toISOString(),
    team1: "Hiszpania",
    team2: "Rep. Ziel. Przylądka",
    venue: "Atlanta",
    score1: 3,
    score2: 0,
    attendance: null, // zakończony, ale frekwencja jeszcze nie dociągnięta z API
    status: "FINISHED",
  },
  {
    ...base,
    id: 5,
    stage: "qf",
    group_label: null,
    kickoff: new Date(now + 48 * hour).toISOString(),
    team1: "Zwycięzca M73",
    team2: "Zwycięzca M74",
    venue: null, // mecz pucharowy bez ustalonego stadionu — wiersz venue się nie pokaże
    score1: null,
    score2: null,
    attendance: null,
    status: "SCHEDULED",
  },
];

const preds: Record<number, { pred1: number; pred2: number }> = {
  1: { pred1: 2, pred2: 0 },
  2: { pred1: 2, pred2: 1 }, // trafiony dokładny wynik → +3
  3: { pred1: 1, pred2: 1 },
};

// Mock drabinki z BRACKET: większość slotów to placeholdery refs; kilka par rozstrzygniętych.
const resolvedTeams: Record<string, [string, string]> = {
  M73: ["Meksyk", "RPA"], // rozstrzygnięty (klikalny — flagi)
  M84: ["Hiszpania", "Argentyna"],
};
const koMatches: Match[] = BRACKET.map((def, i) => {
  const r = resolvedTeams[def.code];
  return {
    ...base,
    id: 1000 + i,
    ext_id: null,
    stage: def.stage,
    group_label: null,
    kickoff: `${def.date}T19:00:00Z`,
    team1: r?.[0] ?? "TBD",
    team2: r?.[1] ?? "TBD",
    venue: def.venueKey,
    score1: null,
    score2: null,
    attendance: null,
    status: "TIMED",
    bracket_code: def.code,
    home_ref: def.home,
    away_ref: def.away,
    home_locked: false,
    away_locked: false,
  };
});

export default function PreviewPage() {
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 18px" }}>
      <h1 style={{ fontFamily: "Anton, sans-serif", fontSize: 28, marginBottom: 4 }}>
        Podgląd kart — venue + frekwencja
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Demo (dane przykładowe): zaplanowany · zakończony z frekwencją · LIVE · zakończony bez
        frekwencji · pucharowy bez stadionu.
      </p>
      <div className="matches">
        {matches.map((m) => (
          <MatchCard key={m.id} match={m} pred={preds[m.id]} now={now} onOpen={() => {}} />
        ))}
      </div>

      <h1 style={{ fontFamily: "Anton, sans-serif", fontSize: 28, margin: "36px 0 4px" }}>
        Drabinka pucharowa — placeholdery refs
      </h1>
      <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 20 }}>
        Sloty nierozstrzygnięte pokazują etykietę („1. grupy E", „3. miejsce (A/B/C/D/F)", „Zwyc. M73");
        pary z dwiema znanymi drużynami (M73, M84) są klikalne do typowania.
      </p>
      <KnockoutBracket matches={koMatches} onOpenMatch={() => {}} />
    </div>
  );
}
