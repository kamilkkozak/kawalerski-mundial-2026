// Generuje seed_fixtures.sql z terminarza zaszytego w prototypie (KawalerskiMundial2026.jsx).
// Użycie: node supabase/generate-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO = join(__dirname, "..", "..", "KawalerskiMundial2026.jsx");

const src = readFileSync(PROTO, "utf8");
const m = src.match(/const DATA\s*=\s*(\{[\s\S]*?\});/);
if (!m) throw new Error("Nie znaleziono obiektu DATA w prototypie");
const DATA = JSON.parse(m[1]);

const esc = (s) => (s == null ? null : String(s).replace(/'/g, "''"));
const val = (s) => (s == null ? "null" : `'${esc(s)}'`);

const lines = [];
lines.push("-- AUTO-GENEROWANE z KawalerskiMundial2026.jsx — nie edytuj ręcznie.");
lines.push("-- Terminarz fazy grupowej Mundialu 2026 (czas UTC).");
lines.push("-- Mecze pucharowe dochodzą po losowaniu/fazie grupowej (panel admina lub kolejny seed).");
lines.push("");
lines.push("-- Idempotentne: czyści i wgrywa fazę grupową od nowa.");
lines.push("delete from public.matches where stage = 'group';");
lines.push("");
lines.push(
  "insert into public.matches (stage, group_label, kickoff, team1, team2, flag1, flag2, venue, status) values"
);

const rows = DATA.fixtures.map((f) => {
  return `  ('group', ${val(f.group)}, '${f.kickoff}', ${val(f.t1)}, ${val(f.t2)}, ${val(
    f.f1
  )}, ${val(f.f2)}, ${val(f.venue)}, 'SCHEDULED')`;
});
lines.push(rows.join(",\n") + ";");
lines.push("");

const out = join(__dirname, "seed_fixtures.sql");
writeFileSync(out, lines.join("\n"), "utf8");
console.log(`Zapisano ${DATA.fixtures.length} meczów do ${out}`);
