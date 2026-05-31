// DEMO: 3 fikcyjnych graczy + wyniki w 4 pierwszych meczach + typy (mix 3/1/0).
// Sprzątanie: node scripts/demo-clean.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function env(key) {
  const m = readFileSync(join(root, ".env.local"), "utf8").match(new RegExp(`^${key}=(.*)$`, "m"));
  return m ? m[1].trim() : "";
}
const SUPABASE_URL = env("NEXT_PUBLIC_SUPABASE_URL");
const SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY");
const DB_URL = process.argv[2] || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("Brak connection stringa. Podaj jako 1. argument albo ustaw env DATABASE_URL.");
  process.exit(1);
}

const DEMO = [
  { email: "rafalonek@demo.mundial", name: "Rafałonek" },
  { email: "bartonek@demo.mundial", name: "Bartonek" },
  { email: "staszonek@demo.mundial", name: "Staszonek" },
];

// Wyniki dla 4 pierwszych meczów oraz typy graczy (klucz = nazwa gracza).
const RESULTS = [
  { s1: 2, s2: 1 },
  { s1: 0, s2: 0 },
  { s1: 3, s2: 0 },
  { s1: 1, s2: 2 },
];
// Typy: [ [p1,p2] x4 ] per gracz. (Rafałonek celowo trafia prawie wszystko.)
const PREDS = {
  Rafałonek: [[1, 0], [0, 0], [3, 0], [1, 2]],
  Bartonek: [[0, 2], [2, 2], [1, 0], [2, 1]],
  Staszonek: [[3, 1], [1, 0], [4, 0], [0, 3]],
  __me__: [[2, 1], [1, 1], [2, 0], [0, 0]],
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

try {
  // 1) Stwórz fikcyjnych graczy (trigger założy players + bonus_picks).
  for (const u of DEMO) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      email_confirm: true,
      user_metadata: { name: u.name },
    });
    if (error && !/already/i.test(error.message)) console.log(`  ${u.name}:`, error.message);
    else console.log(`✓ gracz ${u.name}`);
  }

  await client.connect();

  // 2) Pierwsze 4 mecze -> FINISHED z wynikiem.
  const { rows: matches } = await client.query(
    "select id from public.matches order by kickoff asc limit 4"
  );
  for (let i = 0; i < matches.length; i++) {
    await client.query(
      "update public.matches set score1=$1, score2=$2, status='FINISHED' where id=$3",
      [RESULTS[i].s1, RESULTS[i].s2, matches[i].id]
    );
  }
  console.log(`✓ ustawiono wyniki w ${matches.length} meczach`);

  // 3) Typy graczy (w tym Twoje, jeśli jesteś w bazie).
  const { rows: players } = await client.query("select id, name from public.players");
  const byName = Object.fromEntries(players.map((p) => [p.name, p.id]));
  const me = players.find((p) => p.name === "Kodżonek");

  async function setPreds(playerId, arr) {
    for (let i = 0; i < matches.length; i++) {
      await client.query(
        `insert into public.predictions (player_id, match_id, pred1, pred2)
         values ($1,$2,$3,$4)
         on conflict (player_id, match_id) do update set pred1=excluded.pred1, pred2=excluded.pred2`,
        [playerId, matches[i].id, arr[i][0], arr[i][1]]
      );
    }
  }

  for (const u of DEMO) if (byName[u.name]) await setPreds(byName[u.name], PREDS[u.name]);
  if (me) await setPreds(me.id, PREDS.__me__);
  console.log("✓ wpisano typy");

  // 4) Pokaż tabelę.
  const { rows: standings } = await client.query("select * from public.get_standings()");
  console.log("\n=== TABELA (get_standings) ===");
  standings.forEach((r, i) =>
    console.log(
      `${i + 1}. ${r.name.padEnd(12)} ${String(r.points).padStart(3)} pkt  (trafione wyniki: ${r.exact_hits})`
    )
  );
} catch (e) {
  console.error("✗", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
