// Składy reprezentacji (źródło: public/squads.json, generowane z data/ skryptem
// scripts/build-squads.mjs). Ładowane leniwie po stronie klienta (cache w module).

export type SquadPlayer = { name: string; pos: "GK" | "DF" | "MF" | "FW"; club: string };
export type Squad = { team: string; players: SquadPlayer[] };

export const POS_ORDER: SquadPlayer["pos"][] = ["GK", "DF", "MF", "FW"];
export const POS_LABEL: Record<SquadPlayer["pos"], string> = {
  GK: "Bramkarze",
  DF: "Obrońcy",
  MF: "Pomocnicy",
  FW: "Napastnicy",
};

// Normalizacja do wyszukiwania (małe litery, bez diakrytyków, ł->l).
export function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l") // ł
    .trim();
}

let cache: Squad[] | null = null;
export async function loadSquads(): Promise<Squad[]> {
  if (cache) return cache;
  const res = await fetch("/squads.json", { cache: "force-cache" });
  if (!res.ok) throw new Error("Nie udało się wczytać składów.");
  const data = (await res.json()) as { teams: Squad[] };
  cache = data.teams ?? [];
  return cache;
}
