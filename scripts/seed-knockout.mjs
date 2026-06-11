// Seeduje mecze pucharowe M73–M104 wg STAŁEJ struktury z lib/bracket.ts
// (kod, etap, sloty home_ref/away_ref, arena/venue, data). Drużyny = "TBD" — uzupełni je
// auto-obsada (Etap 2) albo panel admina. Zwycięzcy kolejnych rund wpadają automatycznie (cron).
//
// Godziny i ext_id (do auto-syncu wyników) próbujemy nałożyć z football-data.org, wyrównując
// mecze API do naszych kodów po (etap + kolejność dat). Gdy API niedostępne — kickoff = data + 19:00 UTC.
// Po seedzie drukujemy raport obsady do weryfikacji.
//
// Idempotentne: czyści i wgrywa puchary od nowa.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { BRACKET } from "../lib/bracket.ts";
import { mapFdStage } from "../lib/stages.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
function env(key) {
  const m = readFileSync(join(root, ".env.local"), "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}
const API_KEY = env("FOOTBALL_DATA_API_KEY");
const DB_URL = process.argv[2] || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("Brak connection stringa. Podaj jako 1. argument albo ustaw env DATABASE_URL.");
  process.exit(1);
}

// --- spróbuj nałożyć godziny + ext_id z API (best-effort, opcjonalne) ---
const apiByCode = new Map(); // code -> { extId, utcDate, status }
try {
  const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
    headers: API_KEY ? { "X-Auth-Token": API_KEY } : {},
  });
  if (res.ok) {
    const { matches } = await res.json();
    const ko = (matches || []).filter((m) => m.stage !== "GROUP_STAGE");
    // pogrupuj API po naszym etapie, posortuj po dacie
    const byStage = {};
    for (const m of ko) {
      const st = mapFdStage(m.stage);
      (byStage[st] ||= []).push(m);
    }
    for (const list of Object.values(byStage)) list.sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
    // nasze kody danego etapu posortowane po dacie (kolejność jak w terminarzu)
    const ourByStage = {};
    for (const def of BRACKET) (ourByStage[def.stage] ||= []).push(def);
    for (const list of Object.values(ourByStage)) list.sort((a, b) => a.date.localeCompare(b.date) || a.code.localeCompare(b.code));
    // zip kolejnościowy w obrębie etapu
    for (const [stage, defs] of Object.entries(ourByStage)) {
      const apis = byStage[stage] || [];
      if (apis.length !== defs.length) {
        console.warn(`! Etap ${stage}: API ma ${apis.length} meczów, my ${defs.length} — pomijam linkowanie tego etapu (kickoff = data+19:00).`);
        continue;
      }
      defs.forEach((def, i) => {
        const a = apis[i];
        apiByCode.set(def.code, {
          extId: a.id,
          utcDate: a.utcDate,
          status: a.status === "FINISHED" ? "FINISHED" : a.status === "IN_PLAY" ? "IN_PLAY" : a.status === "PAUSED" ? "PAUSED" : "TIMED",
        });
      });
    }
    console.log(`✓ Z API nałożono godziny/ext_id dla ${apiByCode.size}/${BRACKET.length} meczów KO.`);
  } else {
    console.warn("! API football-data niedostępne (", res.status, ") — kickoff = data+19:00 UTC, bez ext_id.");
  }
} catch (e) {
  console.warn("! Brak połączenia z API — kickoff = data+19:00 UTC, bez ext_id.", e.message);
}

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query("delete from public.matches where stage <> 'group'");
  let n = 0;
  for (const def of BRACKET) {
    const api = apiByCode.get(def.code);
    const kickoff = api?.utcDate ?? `${def.date}T19:00:00Z`;
    const status = api?.status ?? "TIMED";
    await client.query(
      `insert into public.matches
         (ext_id, bracket_code, stage, group_label, kickoff, team1, team2, flag1, flag2,
          venue, home_ref, away_ref, status)
       values ($1,$2,$3,null,$4,'TBD','TBD',null,null,$5,$6,$7,$8)`,
      [api?.extId ?? null, def.code, def.stage, kickoff, def.venueKey, def.home, def.away, status]
    );
    n++;
  }

  console.log(`✓ Wgrano ${n} meczów pucharowych (M73–M104).`);
  // Raport obsady do weryfikacji
  const { rows } = await client.query(
    `select bracket_code, stage, to_char(kickoff,'YYYY-MM-DD HH24:MI') kick, venue, home_ref, away_ref,
            (ext_id is not null) linked
       from public.matches where stage<>'group' order by kickoff, bracket_code`
  );
  console.log("\nRaport drabinki (zweryfikuj areny/sloty z oficjalnym terminarzem):");
  for (const r of rows) {
    console.log(
      `  ${r.bracket_code.padEnd(5)} ${r.stage.padEnd(5)} ${r.kick}  ${String(r.venue).padEnd(14)} ${r.home_ref}–${r.away_ref}${r.linked ? "" : "  (brak ext_id)"}`
    );
  }
} catch (e) {
  console.error("✗", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
