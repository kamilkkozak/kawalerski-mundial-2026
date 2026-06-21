// =====================================================================
// Integracja Varzesh3 (web-api.varzesh3.com) — TYLKO wyniki LIVE.
// Darmowe, bez klucza. Źródło: irański portal sportowy; jego wewnętrzne API
// livescore podaje wyniki na żywo MŚ 2026 (liga id 28), z polami host/guest,
// goals, status (7=zakończony, 1=przed gwizdkiem), isLive, liveTime.
//
// Odizolowane od reszty: jeśli API padnie, zmieni format albo zostanie
// zablokowane geograficznie (Vercel w USA ↔ serwer w Iranie), łapiemy błąd
// w try/catch wyżej i apka działa dalej (football-data + ręczne wyniki).
//
// Podział odpowiedzialności:
//   • Varzesh3  → wynik W TRAKCIE meczu (status IN_PLAY) — zastępuje ręczne klepanie
//   • football-data / admin → wynik KOŃCOWY (FINISHED) — tego Varzesh3 NIE rusza
// =====================================================================

import type { SupabaseClient } from "@supabase/supabase-js";
import { toPl } from "./footballdata";

const V3_BASE = "https://web-api.varzesh3.com/v2.0/livescore";
const V3_WC_LEAGUE_ID = 28; // World Cup na Varzesh3
// Bez nagłówka przeglądarki API bywa blokowane (zwraca HTML zamiast JSON).
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Perski → angielski (angielski → polski robi istniejące toPl — jedno źródło prawdy).
// 52 warianty z football.teams.json + team-name-map.json (rezarahiminia/worldcup2026),
// zweryfikowane realnymi stringami z livescore ligi 28.
const FA_TO_EN: Record<string, string> = {
  "الجزایر": "Algeria", "آرژانتین": "Argentina", "استرالیا": "Australia", "اتریش": "Austria",
  "بلژیک": "Belgium", "بوسنی و هرزگوین": "Bosnia and Herzegovina", "بوسنی": "Bosnia and Herzegovina",
  "برزیل": "Brazil", "کانادا": "Canada", "کیپ ورد": "Cape Verde", "کلمبیا": "Colombia",
  "کرواسی": "Croatia", "کوراسائو": "Curaçao", "جمهوری چک": "Czech Republic",
  "جمهوری دموکراتیک کنگو": "Democratic Republic of the Congo", "جمهوری کنگو": "Democratic Republic of the Congo",
  "اکوادور": "Ecuador", "مصر": "Egypt", "انگلستان": "England", "انگلیس": "England",
  "فرانسه": "France", "آلمان": "Germany", "غنا": "Ghana", "هائیتی": "Haiti", "ایران": "Iran",
  "عراق": "Iraq", "ساحل عاج": "Ivory Coast", "ژاپن": "Japan", "اردن": "Jordan", "مکزیک": "Mexico",
  "مراکش": "Morocco", "هلند": "Netherlands", "نیوزیلند": "New Zealand", "نروژ": "Norway",
  "پاناما": "Panama", "پاراگوئه": "Paraguay", "پرتغال": "Portugal", "قطر": "Qatar",
  "عربستان": "Saudi Arabia", "اسکاتلند": "Scotland", "سنگال": "Senegal", "آفریقای جنوبی": "South Africa",
  "کره جنوبی": "South Korea", "اسپانیا": "Spain", "سوئد": "Sweden", "سوئیس": "Switzerland",
  "سوییس": "Switzerland", "تونس": "Tunisia", "ترکیه": "Turkey", "آمریکا": "United States",
  "اروگوئه": "Uruguay", "ازبکستان": "Uzbekistan",
};

// Perski (z Varzesh3) → polski (nasz). null = nieznana drużyna (logujemy do dostrojenia).
export function faToPl(faName?: string | null): string | null {
  if (!faName) return null;
  const en = FA_TO_EN[faName.trim()];
  return en ? toPl(en) : null;
}

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

function toInt(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

// --------------------------------------------------------------- klient
type V3Match = {
  id: number | string;
  host?: { name?: string };
  guest?: { name?: string };
  goals?: { host?: number | string | null; guest?: number | string | null };
  status?: number; // 7 = zakończony, 1 = przed gwizdkiem
  isLive?: boolean;
  liveTime?: string;
};

async function fetchV3(offset: number): Promise<V3Match[]> {
  const url = offset === 0 ? `${V3_BASE}/today` : `${V3_BASE}/${offset}`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`varzesh3 ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) return [];
  const wc = (data as any[]).find((l) => l?.id === V3_WC_LEAGUE_ID);
  if (!wc) return [];
  const out: V3Match[] = [];
  for (const dg of wc.dates ?? []) for (const m of dg.matches ?? []) out.push(m);
  return out;
}

// ===================================================================
// GŁÓWNY ORCHESTRATOR — wołany z crona w try/catch. Aktualizuje wynik
// meczów aktualnie LIVE; nie tyka meczów FINISHED (te należą do football-data/admina).
// dryRun: nic nie zapisuje, zwraca pełny raport porównawczy (do weryfikacji mapowania).
// ===================================================================
export async function syncLiveScores(
  supabase: SupabaseClient,
  opts: { dryRun?: boolean } = {}
) {
  const dryRun = !!opts.dryRun;
  const summary = {
    note: null as string | null,
    v3Matches: 0,
    matchedDb: 0,
    liveFound: 0,
    finishedSeen: 0,
    updated: 0,
    unmatched: [] as string[],
    report: [] as Array<Record<string, unknown>>,
  };

  // Najpierw nasze mecze — i sprawdź, czy w ogóle jest sens pytać Varzesh3.
  const { data } = await supabase
    .from("matches")
    .select("id, team1, team2, status, score1, score2, kickoff");
  const ours = (data ?? []) as Array<{
    id: number; team1: string; team2: string;
    status: string; score1: number | null; score2: number | null; kickoff: string;
  }>;
  const byPair = new Map(ours.map((m) => [pairKey(m.team1, m.team2), m]));

  // Okno "może być live": od −5 min do +150 min od gwizdka, mecz jeszcze nie FINISHED.
  const now = Date.now();
  const hasLiveWindow = ours.some((m) => {
    if (m.status === "FINISHED") return false;
    const k = +new Date(m.kickoff);
    return now >= k - 5 * 60 * 1000 && now <= k + 150 * 60 * 1000;
  });
  // W trybie roboczym nie pukamy do Varzesh3, gdy nic nie może być live (uprzejmość
  // + mniejsze ryzyko geo-bloku przy częstym cronie). W dry-run zawsze pobieramy.
  if (!dryRun && !hasLiveWindow) {
    summary.note = "no-live-window";
    return summary;
  }

  // Pobierz okno dni (−1/0/+1) — duża różnica stref między miejscem meczu (Ameryki)
  // a "dniem" Varzesh3 (Iran) może przerzucić mecz na sąsiedni dzień. Dedup po id.
  const seen = new Map<string, V3Match>();
  for (const off of [-1, 0, 1]) {
    try {
      for (const m of await fetchV3(off)) seen.set(String(m.id), m);
    } catch (e) {
      // pojedynczy offset może zawieść — kontynuuj z resztą
      summary.report.push({ fetchError: `off ${off}: ${(e as Error).message}` });
    }
  }
  summary.v3Matches = seen.size;
  if (seen.size === 0) {
    summary.note = "no-v3-data"; // wszystkie offsety padły (np. geo-blok) → no-op
    return summary;
  }

  for (const vm of Array.from(seen.values())) {
    const plHost = faToPl(vm.host?.name);
    const plGuest = faToPl(vm.guest?.name);
    if (!plHost || !plGuest) {
      const raw = `${vm.host?.name ?? "?"} / ${vm.guest?.name ?? "?"}`;
      if (vm.host?.name || vm.guest?.name) summary.unmatched.push(raw);
      continue;
    }
    const m = byPair.get(pairKey(plHost, plGuest));
    if (!m) {
      summary.unmatched.push(`${plHost} – ${plGuest} (brak w bazie)`);
      continue;
    }
    summary.matchedDb++;

    // Wyrównaj wynik do NASZEJ kolejności team1/team2 (Varzesh3 ma własną host/guest).
    const gHost = toInt(vm.goals?.host);
    const gGuest = toInt(vm.goals?.guest);
    let s1: number | null, s2: number | null;
    if (plHost === m.team1) { s1 = gHost; s2 = gGuest; }
    else { s1 = gGuest; s2 = gHost; } // odwrócone (host = nasze team2)

    const live = vm.isLive === true;
    const finished = vm.status === 7;
    if (live) summary.liveFound++;
    if (finished) summary.finishedSeen++;

    // Czy zaktualizujemy? Tylko mecze LIVE i tylko jeśli w bazie nie są jeszcze FINISHED
    // (wynik końcowy należy do football-data/admina — nie nadpisujemy).
    const dbFinished = m.status === "FINISHED";
    const wouldUpdate =
      live && !dbFinished && s1 != null && s2 != null &&
      (m.status !== "IN_PLAY" || m.score1 !== s1 || m.score2 !== s2);

    if (dryRun) {
      summary.report.push({
        mecz: `${m.team1}–${m.team2}`,
        v3: `${s1 ?? "-"}:${s2 ?? "-"}`,
        baza: `${m.score1 ?? "-"}:${m.score2 ?? "-"}`,
        v3Status: live ? "LIVE" : finished ? "FIN" : "NS",
        bazaStatus: m.status,
        zaktualizowalbym: wouldUpdate,
      });
      if (wouldUpdate) summary.updated++;
      continue;
    }

    if (wouldUpdate) {
      await supabase
        .from("matches")
        .update({
          score1: s1, score2: s2, status: "IN_PLAY",
          updated_at: new Date().toISOString(),
        })
        .eq("id", m.id);
      summary.updated++;
    }
  }

  return summary;
}
