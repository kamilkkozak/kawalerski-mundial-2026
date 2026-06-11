// Generator public/squads.json z data/sklady_mundial_2026.json.
// Mapuje nazwy krajów na kanoniczne (jak w lib/teams.ts), przycina pola.
// Uruchom: node scripts/build-squads.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// JSON -> kanoniczna nazwa z lib/teams.ts (różnią się tylko te poniżej; reszta 1:1).
const TEAM_MAP = {
  "Arabia Saudyjska": "Arabia Saud.",
  "Bośnia i Hercegowina": "Bośnia",
  "Curacao": "Curaçao",
  "DR Kongo": "DR Konga",
  "Korea Południowa": "Korea Płd.",
  "Republika Południowej Afryki": "RPA",
  "Republika Zielonego Przylądka": "Rep. Ziel. Przylądka",
  "Wybrzeże Kości Słoniowej": "Wyb. K. Słoniowej",
};

const src = JSON.parse(readFileSync(join(root, "data/sklady_mundial_2026.json"), "utf8"));

const teams = src.teams
  .map((t) => ({
    team: TEAM_MAP[t.team] ?? t.team,
    players: t.players
      .filter((p) => p && p.name)
      .map((p) => ({ name: p.name.trim(), pos: p.position, club: (p.club ?? "").trim() })),
  }))
  .sort((a, b) => a.team.localeCompare(b.team, "pl"));

writeFileSync(join(root, "public/squads.json"), JSON.stringify({ teams }), "utf8");
console.log("✓ public/squads.json:", teams.length, "drużyn,", teams.reduce((n, t) => n + t.players.length, 0), "zawodników");
