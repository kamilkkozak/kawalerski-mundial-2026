// Silnik punktacji i logika blokady — port 1:1 z prototypu (scoreMatch / lockAt).
// UWAGA: to jest źródło prawdy dla UI. Walidacja blokady jest dodatkowo
// egzekwowana po stronie serwera (Postgres RPC) — patrz supabase/migrations.

export const LOCK_MS = 60 * 1000; // 60 s przed gwizdkiem
export const BONUS_PTS = 10;

export type Pred = { a: number | null; b: number | null };
export type Res = { a: number | null; b: number | null };

/** Punkty za pojedynczy mecz: 3 = dokładny wynik, 1 = trafione rozstrzygnięcie, 0 = pudło, null = brak typu/wyniku. */
export function scoreMatch(pred?: Pred | null, res?: Res | null): number | null {
  if (!pred || !res) return null;
  if (pred.a == null || pred.b == null || res.a == null || res.b == null) return null;
  const { a: pa, b: pb } = pred;
  const { a: ra, b: rb } = res;
  if (pa === ra && pb === rb) return 3;
  if (Math.sign(pa - pb) === Math.sign(ra - rb)) return 1;
  return 0;
}

/** Moment blokady typu na dany mecz (ms epoch). */
export function lockAtMs(kickoffIso: string): number {
  return new Date(kickoffIso).getTime() - LOCK_MS;
}

/** Czy typ na mecz jest już zablokowany przy podanym "teraz". */
export function isLocked(kickoffIso: string, nowMs: number = Date.now()): boolean {
  return nowMs >= lockAtMs(kickoffIso);
}

export function norm(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

export type MatchStatusKind = "open" | "soon" | "lock" | "done";

/** Status karty meczu na potrzeby UI. */
export function matchStatus(
  kickoffIso: string,
  hasResult: boolean,
  nowMs: number = Date.now()
): { kind: MatchStatusKind; label: string; minsToLock: number } {
  const lock = lockAtMs(kickoffIso);
  const minsToLock = Math.round((lock - nowMs) / 60000);
  if (hasResult) return { kind: "done", label: "Po meczu", minsToLock };
  if (nowMs >= lock) return { kind: "lock", label: "Zablokowane", minsToLock };
  if (minsToLock <= 60) return { kind: "soon", label: `Blokada za ${minsToLock} min`, minsToLock };
  return { kind: "open", label: "Otwarte", minsToLock };
}
