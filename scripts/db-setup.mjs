// Wgrywa schemat + funkcje + seed do bazy Supabase.
// Idempotentne (create ... if not exists / or replace / drop ... if exists).
//
// Użycie:
//   node scripts/db-setup.mjs "postgresql://postgres:HASLO@db.REF.supabase.co:5432/postgres"
// lub ustaw zmienną SUPABASE_DB_URL.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const connectionString = process.argv[2] || process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Podaj connection string jako argument lub w SUPABASE_DB_URL.");
  process.exit(1);
}

const files = [
  "supabase/migrations/0001_schema.sql",
  "supabase/migrations/0002_functions_rls.sql",
  "supabase/seed_fixtures.sql",
];

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log("✓ Połączono z bazą");
  for (const f of files) {
    const sql = readFileSync(join(root, f), "utf8");
    process.stdout.write(`→ ${f} … `);
    await client.query(sql);
    console.log("ok");
  }
  const { rows } = await client.query("select count(*)::int as n from public.matches");
  console.log(`✓ Gotowe. Meczów w bazie: ${rows[0].n}`);
} catch (e) {
  console.error("✗ Błąd:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
