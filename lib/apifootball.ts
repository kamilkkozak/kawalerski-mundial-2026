// =====================================================================
// Integracja API-Football (api-sports.io) — TYLKO statystyki meczów.
// Odizolowana od football-data.org: osobny klucz, osobne tabele, własny
// guard limitu. Jeśli ten moduł padnie, reszta apki działa bez zmian.
//
// Pobieranie: WYŁĄCZNIE dla meczów FINISHED bez statystyk, raz, z twardym
// limitem ~80 zapytań/dobę (apif_quota) + cap na liczbę meczów na jeden run.
// =====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { toPl } from "./footballdata";

const BASE = "https://v3.football.api-sports.io";
export const APIF_LEAGUE = 1; // World Cup
export const APIF_SEASON = 2026;

const DAILY_CAP = 80;   // twardy sufit < darmowego limitu 100/dobę
const MAX_PER_RUN = 2;  // ile meczów obsłużyć w jednym przebiegu crona
const MAX_ATTEMPTS = 4; // ile razy próbować, gdy API nie ma jeszcze statystyk
const RETRY_GAP_MS = 3 * 60 * 60 * 1000; // odstęp między próbami dla pustych

// --------------------------------------------------------------- klient
type ApifResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  results: number;
  remaining: number | null; // x-ratelimit-requests-remaining (dzienny, realtime)
};

async function apifGet<T>(path: string, apiKey: string): Promise<ApifResult<T>> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": apiKey },
    cache: "no-store",
  });
  const rem = res.headers.get("x-ratelimit-requests-remaining");
  const remaining = rem != null && rem !== "" ? Number(rem) : null;
  if (!res.ok) return { ok: false, status: res.status, data: null, results: 0, remaining };
  const json = (await res.json()) as { response?: T; results?: number };
  return {
    ok: true,
    status: res.status,
    data: (json.response ?? null) as T | null,
    results: typeof json.results === "number" ? json.results : 0,
    remaining,
  };
}

// --------------------------------------------------------- coverage (1 req)
export type Coverage = {
  ok: boolean;
  status?: number;
  league?: string | null;
  remaining: number | null;
  supports?: { statistics: boolean; lineups: boolean; events: boolean };
  raw?: unknown;
};

export async function fetchCoverage(apiKey: string): Promise<Coverage> {
  const r = await apifGet<any[]>(`/leagues?id=${APIF_LEAGUE}&season=${APIF_SEASON}`, apiKey);
  if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) {
    return { ok: false, status: r.status, remaining: r.remaining };
  }
  const league = r.data[0];
  const seasons: any[] = league?.seasons ?? [];
  const season = seasons.find((s) => s?.year === APIF_SEASON) ?? seasons[seasons.length - 1];
  const cov = season?.coverage ?? null;
  return {
    ok: true,
    remaining: r.remaining,
    league: league?.league?.name ?? null,
    supports: {
      statistics: !!cov?.fixtures?.statistics_fixtures,
      lineups: !!cov?.lineups,
      events: !!cov?.fixtures?.events,
    },
    raw: cov,
  };
}

// ------------------------------------------------------------- parsery
type TeamStats = {
  possession: number | null;
  shots: number | null;
  shots_on: number | null;
  corners: number | null;
  fouls: number | null;
  yellow: number | null;
  red: number | null;
};

const STAT_MAP: Record<string, keyof TeamStats> = {
  "Ball Possession": "possession",
  "Total Shots": "shots",
  "Shots on Goal": "shots_on",
  "Corner Kicks": "corners",
  Fouls: "fouls",
  "Yellow Cards": "yellow",
  "Red Cards": "red",
};

function parseNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseInt(v.replace("%", "").trim(), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseTeamBlock(block: any): TeamStats {
  const out: TeamStats = { possession: null, shots: null, shots_on: null, corners: null, fouls: null, yellow: null, red: null };
  for (const s of block?.statistics ?? []) {
    const key = STAT_MAP[s?.type];
    if (key) out[key] = parseNum(s?.value);
  }
  return out;
}

const teamMatches = (apiName: string | undefined, ourName: string) =>
  !!apiName && toPl(apiName) === ourName;

// Dopasuj dwa bloki API do naszych team1/team2 (po nazwie EN→PL; fallback: kolejność).
function alignBlocks<T extends { team?: { name?: string } }>(
  blocks: T[],
  team1: string,
  team2: string
): { b1: T | null; b2: T | null; aligned: boolean } {
  if (!Array.isArray(blocks) || blocks.length === 0) return { b1: null, b2: null, aligned: false };
  const b1 = blocks.find((b) => teamMatches(b.team?.name, team1)) ?? null;
  const b2 = blocks.find((b) => teamMatches(b.team?.name, team2)) ?? null;
  if (b1 && b2) return { b1, b2, aligned: true };
  // Fallback: kolejność z API (home, away) — najlepszy wysiłek.
  return { b1: blocks[0] ?? null, b2: blocks[1] ?? null, aligned: false };
}

function normalizeLineups(data: any[] | null, team1: string, team2: string) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const { b1, b2 } = alignBlocks(data, team1, team2);
  const side = (b: any) =>
    b
      ? {
          formation: b.formation ?? null,
          coach: b.coach?.name ?? null,
          xi: (b.startXI ?? []).map((e: any) => ({
            n: e?.player?.number ?? null,
            name: e?.player?.name ?? null,
            pos: e?.player?.pos ?? null,
          })),
        }
      : null;
  return { team1: side(b1), team2: side(b2) };
}

function normalizeEvents(data: any[] | null) {
  if (!Array.isArray(data) || data.length === 0) return null;
  return data.map((e) => ({
    minute: (e?.time?.elapsed ?? 0) + (e?.time?.extra ? `+${e.time.extra}` : ""),
    team: toPl(e?.team?.name) ?? e?.team?.name ?? null,
    player: e?.player?.name ?? null,
    assist: e?.assist?.name ?? null,
    type: e?.type ?? null,
    detail: e?.detail ?? null,
  }));
}

// ----------------------------------------------------------- bookkeeping
const todayUtc = () => new Date().toISOString().slice(0, 10);
const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);
const pairKey = (a: string, b: string) => [a, b].sort().join("|");

type MatchRow = { id: number; kickoff: string; team1: string; team2: string; apif_fixture_id: number | null };

// ===================================================================
// GŁÓWNY ORCHESTRATOR — wołany z crona w osobnym try/catch.
// Zwraca podsumowanie; nigdy nie rzuca dalej (łapiemy błędy wewnątrz).
// ===================================================================
export async function syncMatchStats(supabase: SupabaseClient, apiKey: string) {
  const summary = {
    skipped: null as string | null,
    used: 0,
    mapped: 0,
    statsFetched: 0,
    empty: 0,
    unmatched: [] as string[],
  };

  const today = todayUtc();

  // 1) Quota guard — czytamy zużycie z dziś (tabela musi istnieć; brak → throw → cron łapie).
  const { data: q } = await supabase.from("apif_quota").select("count").eq("day", today).maybeSingle();
  let count: number = (q?.count as number) ?? 0;
  if (count >= DAILY_CAP) {
    summary.skipped = "quota";
    return summary;
  }

  let stop = false; // ustawiane gdy API zgłosi remaining=0
  const canCall = () => !stop && count + summary.used < DAILY_CAP;
  const note = <T,>(r: ApifResult<T>): ApifResult<T> => {
    summary.used++;
    if (r.remaining != null && r.remaining <= 0) stop = true;
    return r;
  };

  // 2) Kandydaci: FINISHED bez kompletnych statystyk (z limitem retry dla pustych).
  const { data: finishedRaw } = await supabase
    .from("matches")
    .select("id, kickoff, team1, team2, apif_fixture_id")
    .eq("status", "FINISHED");
  const finished = (finishedRaw ?? []) as MatchRow[];
  if (finished.length === 0) {
    summary.skipped = "no-finished";
    return summary;
  }

  const { data: statRows } = await supabase
    .from("match_stats")
    .select("match_id, available, attempts, last_attempt_at");
  const statById = new Map<number, { available: boolean; attempts: number; last_attempt_at: string | null }>();
  for (const s of statRows ?? []) {
    statById.set((s as any).match_id, {
      available: (s as any).available,
      attempts: (s as any).attempts ?? 0,
      last_attempt_at: (s as any).last_attempt_at ?? null,
    });
  }

  const now = Date.now();
  const candidates = finished.filter((m) => {
    const s = statById.get(m.id);
    if (!s) return true; // nigdy nie próbowane
    if (s.available) return false; // już mamy
    if (s.attempts >= MAX_ATTEMPTS) return false; // poddajemy się
    if (s.last_attempt_at && now - +new Date(s.last_attempt_at) < RETRY_GAP_MS) return false; // za wcześnie
    return true;
  });
  if (candidates.length === 0) {
    summary.skipped = "no-candidates";
    return summary;
  }

  // 3) Mapowanie fixture id (1 zapytanie) — tylko gdy któryś kandydat go nie ma.
  if (candidates.some((m) => !m.apif_fixture_id) && canCall()) {
    const fx = note(await apifGet<any[]>(`/fixtures?league=${APIF_LEAGUE}&season=${APIF_SEASON}`, apiKey));
    if (fx.ok && Array.isArray(fx.data)) {
      const byPair = new Map<string, any[]>();
      for (const f of fx.data) {
        const hp = toPl(f?.teams?.home?.name);
        const ap = toPl(f?.teams?.away?.name);
        if (!hp || !ap) continue;
        const k = pairKey(hp, ap);
        const arr = byPair.get(k);
        if (arr) arr.push(f);
        else byPair.set(k, [f]);
      }
      for (const m of finished) {
        if (m.apif_fixture_id) continue;
        const cands = byPair.get(pairKey(m.team1, m.team2)) ?? [];
        const hit =
          cands.find((f) => dayOf(f?.fixture?.date) === dayOf(m.kickoff)) ?? (cands.length === 1 ? cands[0] : null);
        if (hit?.fixture?.id) {
          await supabase.from("matches").update({ apif_fixture_id: hit.fixture.id }).eq("id", m.id);
          m.apif_fixture_id = hit.fixture.id;
          summary.mapped++;
        } else {
          summary.unmatched.push(`${m.team1} – ${m.team2} (${dayOf(m.kickoff)})`);
        }
      }
    }
  }

  // 4) Pobranie statystyk per mecz (cap MAX_PER_RUN, w ramach budżetu).
  const toProcess = candidates.filter((m) => m.apif_fixture_id).slice(0, MAX_PER_RUN);
  for (const m of toProcess) {
    if (!canCall()) break;
    const fid = m.apif_fixture_id as number;
    const prevAttempts = statById.get(m.id)?.attempts ?? 0;

    const st = note(await apifGet<any[]>(`/fixtures/statistics?fixture=${fid}`, apiKey));
    const blocks = st.ok && Array.isArray(st.data) ? st.data : [];
    const hasStats = blocks.length > 0 && blocks.some((b: any) => (b?.statistics ?? []).length > 0);

    if (!hasStats) {
      await supabase.from("match_stats").upsert(
        { match_id: m.id, available: false, attempts: prevAttempts + 1, last_attempt_at: new Date().toISOString() },
        { onConflict: "match_id" }
      );
      summary.empty++;
      continue;
    }

    const { b1, b2 } = alignBlocks(blocks, m.team1, m.team2);
    const s1 = parseTeamBlock(b1);
    const s2 = parseTeamBlock(b2);

    // Składy + zdarzenia, jeśli budżet pozwala (najlepszy wysiłek).
    let lineups = null;
    if (canCall()) {
      const lu = note(await apifGet<any[]>(`/fixtures/lineups?fixture=${fid}`, apiKey));
      lineups = lu.ok ? normalizeLineups(lu.data, m.team1, m.team2) : null;
    }
    let events = null;
    if (canCall()) {
      const ev = note(await apifGet<any[]>(`/fixtures/events?fixture=${fid}`, apiKey));
      events = ev.ok ? normalizeEvents(ev.data) : null;
    }

    await supabase.from("match_stats").upsert(
      {
        match_id: m.id,
        available: true,
        possession_home: s1.possession, possession_away: s2.possession,
        shots_home: s1.shots, shots_away: s2.shots,
        shots_on_home: s1.shots_on, shots_on_away: s2.shots_on,
        corners_home: s1.corners, corners_away: s2.corners,
        fouls_home: s1.fouls, fouls_away: s2.fouls,
        yellow_home: s1.yellow, yellow_away: s2.yellow,
        red_home: s1.red, red_away: s2.red,
        lineups,
        events,
        raw: blocks,
        attempts: prevAttempts + 1,
        last_attempt_at: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "match_id" }
    );
    summary.statsFetched++;
  }

  // 5) Zapisz zużycie limitu (twardy guard na kolejne przebiegi/dzień).
  if (summary.used > 0) {
    await supabase.from("apif_quota").upsert({ day: today, count: count + summary.used }, { onConflict: "day" });
  }

  return summary;
}
