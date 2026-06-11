// Odpala migrację 0005 (kolumna avatar_url + bucket 'avatars' + polityki RLS Storage)
// przez bezpośrednie połączenie Postgres (rola postgres = właściciel, brak problemów
// z uprawnieniami do storage.objects). Idempotentne.
//
// Connection string: argument, env SUPABASE_DB_URL, albo linia SUPABASE_DB_URL=... w .env.local
//   format: postgresql://postgres:HASLO@db.REF.supabase.co:5432/postgres
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function fromEnvFile() {
  try {
    const txt = readFileSync(join(root, ".env.local"), "utf8");
    const m = txt.match(/^\s*SUPABASE_DB_URL\s*=\s*(.+)\s*$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
}

const connectionString = process.argv[2] || process.env.SUPABASE_DB_URL || fromEnvFile();
if (!connectionString) {
  console.error(
    "Brak connection string. Dodaj do .env.local linię:\n" +
      "  SUPABASE_DB_URL=postgresql://postgres:HASLO@db.REF.supabase.co:5432/postgres\n" +
      "albo podaj go jako argument."
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  console.log("✓ Połączono z bazą");
  const sql = readFileSync(join(root, "supabase/migrations/0005_avatars.sql"), "utf8");
  process.stdout.write("→ 0005_avatars.sql … ");
  await client.query(sql);
  console.log("ok");

  const col = await client.query(
    "select 1 from information_schema.columns where table_schema='public' and table_name='players' and column_name='avatar_url'"
  );
  const bucket = await client.query("select public from storage.buckets where id='avatars'");
  const pols = await client.query(
    "select count(*)::int as n from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'avatars %'"
  );
  console.log(`✓ Gotowe. Kolumna avatar_url: ${col.rowCount ? "jest" : "BRAK"} · ` +
    `bucket avatars: ${bucket.rowCount ? (bucket.rows[0].public ? "public" : "PRYWATNY") : "BRAK"} · ` +
    `polityki Storage: ${pols.rows[0].n}/4`);
} catch (e) {
  console.error("✗ Błąd:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
