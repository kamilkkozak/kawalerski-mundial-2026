// Sprząta dane DEMO: usuwa fikcyjnych graczy (@demo.mundial -> cascade kasuje ich typy/bonusy)
// oraz resetuje wyniki 4 pierwszych meczów do SCHEDULED i czyści Twoje testowe typy.
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
const admin = createClient(env("NEXT_PUBLIC_SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { autoRefreshToken: false, persistSession: false },
});
const DB_URL = process.argv[2] || process.env.DATABASE_URL;
if (!DB_URL) {
  console.error("Brak connection stringa. Podaj jako 1. argument albo ustaw env DATABASE_URL.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();

  // Reset wyników pierwszych 4 meczów.
  const { rows: matches } = await client.query(
    "select id from public.matches order by kickoff asc limit 4"
  );
  for (const m of matches)
    await client.query(
      "update public.matches set score1=null, score2=null, status='SCHEDULED' where id=$1",
      [m.id]
    );
  console.log(`✓ zresetowano wyniki ${matches.length} meczów`);

  // Skasuj testowe typy Kodżonka na tych meczach.
  const { rows: me } = await client.query("select id from public.players where name='Kodżonek'");
  if (me[0]) {
    await client.query(
      "delete from public.predictions where player_id=$1 and match_id = any($2::bigint[])",
      [me[0].id, matches.map((m) => m.id)]
    );
    console.log("✓ usunięto testowe typy Kodżonka");
  }

  // Usuń fikcyjnych graczy z auth (cascade -> players/predictions/bonus_picks).
  const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const demo = (data?.users ?? []).filter((u) => u.email?.endsWith("@demo.mundial"));
  for (const u of demo) {
    await admin.auth.admin.deleteUser(u.id);
    console.log(`✓ usunięto gracza ${u.user_metadata?.name ?? u.email}`);
  }
  console.log("Gotowe — baza wyczyszczona z danych demo.");
} catch (e) {
  console.error("✗", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
