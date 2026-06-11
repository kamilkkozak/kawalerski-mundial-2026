// Stała struktura fazy pucharowej Mundialu 2026 (M73–M104) — bez losowania.
// Źródło prawdy dla: seeda meczów KO, etykiet slotów, układu drabinki i progresji
// zwycięzców. Daty i areny wg oficjalnego terminarza (potwierdzone przez użytkownika).
// UWAGA: kolejność/obsada R16 wg tabeli terminarza (różni się od pierwotnego briefu).

import type { Stage } from "./types";

// Token slotu: "1A".."2L" (miejsce w grupie) | "3/ABCDF" (najlepsze 3. miejsce z jednej
// z wymienionych grup) | "W73" (zwycięzca meczu) | "L101" (przegrany meczu).
export type SlotRef = string;

export type BracketDef = {
  code: string; // "M73".."M104"
  stage: Stage; // r32 | r16 | qf | sf | third | final
  date: string; // "YYYY-MM-DD" (UTC dzień meczu; godzinę dokłada seed/API)
  venueKey: string; // klucz do lib/venues.ts (== pole matches.venue)
  home: SlotRef;
  away: SlotRef;
};

// Pełna drabinka. Daty/areny z autorytatywnego terminarza.
export const BRACKET: BracketDef[] = [
  // Round of 32
  { code: "M73", stage: "r32", date: "2026-06-28", venueKey: "Los Angeles", home: "2A", away: "2B" },
  { code: "M74", stage: "r32", date: "2026-06-29", venueKey: "Boston", home: "1E", away: "3/ABCDF" },
  { code: "M75", stage: "r32", date: "2026-06-29", venueKey: "Monterrey", home: "1F", away: "2C" },
  { code: "M76", stage: "r32", date: "2026-06-29", venueKey: "Houston", home: "1C", away: "2F" },
  { code: "M77", stage: "r32", date: "2026-06-30", venueKey: "New York/NJ", home: "1I", away: "3/CDFGH" },
  { code: "M78", stage: "r32", date: "2026-06-30", venueKey: "Dallas", home: "2E", away: "2I" },
  { code: "M79", stage: "r32", date: "2026-06-30", venueKey: "Mexico City", home: "1A", away: "3/CEFHI" },
  { code: "M80", stage: "r32", date: "2026-07-01", venueKey: "Atlanta", home: "1L", away: "3/EHIJK" },
  { code: "M81", stage: "r32", date: "2026-07-01", venueKey: "San Francisco", home: "1D", away: "3/BEFIJ" },
  { code: "M82", stage: "r32", date: "2026-07-01", venueKey: "Seattle", home: "1G", away: "3/AEHIJ" },
  { code: "M83", stage: "r32", date: "2026-07-02", venueKey: "Toronto", home: "2K", away: "2L" },
  { code: "M84", stage: "r32", date: "2026-07-02", venueKey: "Los Angeles", home: "1H", away: "2J" },
  { code: "M85", stage: "r32", date: "2026-07-02", venueKey: "Vancouver", home: "1B", away: "3/EFGIJ" },
  { code: "M86", stage: "r32", date: "2026-07-03", venueKey: "Miami", home: "1J", away: "2H" },
  { code: "M87", stage: "r32", date: "2026-07-03", venueKey: "Kansas City", home: "1K", away: "3/DEIJL" },
  { code: "M88", stage: "r32", date: "2026-07-03", venueKey: "Dallas", home: "2D", away: "2G" },
  // Round of 16
  { code: "M89", stage: "r16", date: "2026-07-04", venueKey: "Philadelphia", home: "W74", away: "W77" },
  { code: "M90", stage: "r16", date: "2026-07-04", venueKey: "Houston", home: "W73", away: "W75" },
  { code: "M91", stage: "r16", date: "2026-07-05", venueKey: "New York/NJ", home: "W76", away: "W78" },
  { code: "M92", stage: "r16", date: "2026-07-05", venueKey: "Mexico City", home: "W79", away: "W80" },
  { code: "M93", stage: "r16", date: "2026-07-06", venueKey: "Dallas", home: "W83", away: "W84" },
  { code: "M94", stage: "r16", date: "2026-07-06", venueKey: "Seattle", home: "W81", away: "W82" },
  { code: "M95", stage: "r16", date: "2026-07-07", venueKey: "Atlanta", home: "W86", away: "W88" },
  { code: "M96", stage: "r16", date: "2026-07-07", venueKey: "Vancouver", home: "W85", away: "W87" },
  // Quarter-finals
  { code: "M97", stage: "qf", date: "2026-07-09", venueKey: "Boston", home: "W89", away: "W90" },
  { code: "M98", stage: "qf", date: "2026-07-10", venueKey: "Los Angeles", home: "W93", away: "W94" },
  { code: "M99", stage: "qf", date: "2026-07-11", venueKey: "Miami", home: "W91", away: "W92" },
  { code: "M100", stage: "qf", date: "2026-07-11", venueKey: "Kansas City", home: "W95", away: "W96" },
  // Semi-finals
  { code: "M101", stage: "sf", date: "2026-07-14", venueKey: "Dallas", home: "W97", away: "W98" },
  { code: "M102", stage: "sf", date: "2026-07-15", venueKey: "Atlanta", home: "W99", away: "W100" },
  // Third place + Final
  { code: "M103", stage: "third", date: "2026-07-18", venueKey: "Miami", home: "L101", away: "L102" },
  { code: "M104", stage: "final", date: "2026-07-19", venueKey: "New York/NJ", home: "W101", away: "W102" },
];

export const BRACKET_BY_CODE: Record<string, BracketDef> = Object.fromEntries(
  BRACKET.map((b) => [b.code, b])
);

// Czy token to placeholder (slot jeszcze nierozstrzygnięty), a nie konkretna drużyna.
const isPlaceholder = (t?: string | null) => !t || t === "TBD";

// Etykieta slotu po polsku (gdy drużyna nieznana). Dla nieznanego refu zwraca "do ustalenia".
export function refLabel(ref?: string | null): string {
  if (!ref) return "do ustalenia";
  let m: RegExpMatchArray | null;
  if ((m = ref.match(/^([12])([A-L])$/))) {
    return `${m[1]}. grupy ${m[2]}`;
  }
  if ((m = ref.match(/^3\/([A-L]+)$/))) {
    return `3. miejsce (${m[1].split("").join("/")})`;
  }
  if ((m = ref.match(/^W(\d+)$/))) {
    return `Zwyc. M${m[1]}`;
  }
  if ((m = ref.match(/^L(\d+)$/))) {
    return `Przegr. M${m[1]}`;
  }
  return "do ustalenia";
}

// ---- Układ drabinki (lewa/prawa połowa) — dla widoku KnockoutBracket ----
// Kolejność top→bottom musi odpowiadać geometrii drzewa (pary feedują wspólny węzeł).
export const LAYOUT = {
  L: {
    r32: ["M74", "M77", "M73", "M75", "M83", "M84", "M81", "M82"],
    r16: ["M89", "M90", "M93", "M94"],
    qf: ["M97", "M98"],
    sf: ["M101"],
  },
  R: {
    r32: ["M76", "M78", "M79", "M80", "M86", "M88", "M85", "M87"],
    r16: ["M91", "M92", "M95", "M96"],
    qf: ["M99", "M100"],
    sf: ["M102"],
  },
  final: "M104",
  third: "M103",
} as const;

// ---- Progresja zwycięzców/przegranych --------------------------------
// Wejście: dla rozstrzygniętych meczów KO mapa kod -> { winner, loser } (nazwy drużyn).
// Wyjście: lista docelowych slotów do uzupełnienia (kod meczu, strona, drużyna).
// Cron stosuje te aktualizacje pomijając sloty zablokowane ręcznie przez admina.
export type Decided = Record<string, { winner: string | null; loser: string | null }>;

export function progressionUpdates(
  decided: Decided
): { code: string; side: "home" | "away"; team: string }[] {
  const out: { code: string; side: "home" | "away"; team: string }[] = [];
  const resolve = (ref: SlotRef): string | null => {
    let m: RegExpMatchArray | null;
    if ((m = ref.match(/^W(\d+)$/))) return decided[`M${m[1]}`]?.winner ?? null;
    if ((m = ref.match(/^L(\d+)$/))) return decided[`M${m[1]}`]?.loser ?? null;
    return null; // refy grupowe (1X/2X/3X) rozstrzyga Etap 2 / admin
  };
  for (const def of BRACKET) {
    const h = resolve(def.home);
    if (h) out.push({ code: def.code, side: "home", team: h });
    const a = resolve(def.away);
    if (a) out.push({ code: def.code, side: "away", team: a });
  }
  return out;
}

// Czy mecz KO jest gotowy do typowania (obaj rywale to konkretne drużyny).
export function isResolved(team1?: string | null, team2?: string | null): boolean {
  return !isPlaceholder(team1) && !isPlaceholder(team2);
}
