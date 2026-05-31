// Seeduje mecze pucharowe z football-data.org (z ext_id, etapem, godziną).
// Drużyny = "TBD" dopóki API ich nie zna; cron uzupełni je po fazie grupowej.
// Idempotentne: czyści i wgrywa puchary od nowa.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
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

const res = await fetch("https://api.football-data.org/v4/competitions/WC/matches", {
  headers: { "X-Auth-Token": API_KEY },
});
if (!res.ok) {
  console.error("football-data error", res.status, await res.text());
  process.exit(1);
}
const { matches } = await res.json();
const ko = (matches || []).filter((m) => m.stage !== "GROUP_STAGE");

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  await client.query("delete from public.matches where stage <> 'group'");
  let n = 0;
  for (const m of ko) {
    await client.query(
      `insert into public.matches (ext_id, stage, group_label, kickoff, team1, team2, status)
       values ($1,$2,null,$3,$4,$5,$6)`,
      [
        m.id,
        mapFdStage(m.stage),
        m.utcDate,
        m.homeTeam?.name ?? "TBD",
        m.awayTeam?.name ?? "TBD",
        m.status === "FINISHED" ? "FINISHED" : m.status === "IN_PLAY" ? "IN_PLAY" : "TIMED",
      ]
    );
    n++;
  }
  const { rows } = await client.query(
    "select stage, count(*)::int n from public.matches where stage<>'group' group by stage order by 1"
  );
  console.log(`✓ Wgrano ${n} meczów pucharowych`);
  console.log("Po etapach:", rows.map((r) => `${r.stage}:${r.n}`).join(", "));
} catch (e) {
  console.error("✗", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
