// Stałe dane 16 aren Mundialu 2026 — stadion, miasto, kraj (flaga emoji), pojemność.
// NIE pobierane z API. Klucz = wartość pola matches.venue z bazy (nazwa miasta-gospodarza).
// Frekwencja (attendance) jest osobno — dociągana z API po meczu (patrz cron sync-results).

export type VenueInfo = {
  stadium: string; // turniejowa nazwa stadionu
  city: string; // pełna nazwa miasta/lokalizacji
  country: string; // PL nazwa kraju
  cc: string; // kod kraju dla flagcdn (spójnie z flagami drużyn; emoji nie renderuje się na Windows)
  capacity: number; // pojemność (liczba miejsc)
};

// Klucz = miasto jak w bazie (pole venue).
export const VENUES: Record<string, VenueInfo> = {
  "Mexico City": { stadium: "Estadio Azteca", city: "Mexico City", country: "Meksyk", cc: "mx", capacity: 87000 },
  "Guadalajara": { stadium: "Estadio Akron", city: "Zapopan", country: "Meksyk", cc: "mx", capacity: 48000 },
  "Monterrey": { stadium: "Estadio BBVA", city: "Guadalupe", country: "Meksyk", cc: "mx", capacity: 53500 },
  "Toronto": { stadium: "BMO Field", city: "Toronto", country: "Kanada", cc: "ca", capacity: 45000 },
  "Vancouver": { stadium: "BC Place", city: "Vancouver", country: "Kanada", cc: "ca", capacity: 54500 },
  "New York/NJ": { stadium: "MetLife Stadium", city: "East Rutherford, NJ", country: "USA", cc: "us", capacity: 82500 },
  "Los Angeles": { stadium: "SoFi Stadium", city: "Inglewood, CA", country: "USA", cc: "us", capacity: 70000 },
  "Dallas": { stadium: "AT&T Stadium", city: "Arlington, TX", country: "USA", cc: "us", capacity: 94000 },
  "San Francisco": { stadium: "Levi's Stadium", city: "Santa Clara, CA", country: "USA", cc: "us", capacity: 70000 },
  "Miami": { stadium: "Hard Rock Stadium", city: "Miami Gardens, FL", country: "USA", cc: "us", capacity: 65000 },
  "Atlanta": { stadium: "Mercedes-Benz Stadium", city: "Atlanta, GA", country: "USA", cc: "us", capacity: 75000 },
  "Seattle": { stadium: "Lumen Field", city: "Seattle, WA", country: "USA", cc: "us", capacity: 69000 },
  "Houston": { stadium: "NRG Stadium", city: "Houston, TX", country: "USA", cc: "us", capacity: 72000 },
  "Philadelphia": { stadium: "Lincoln Financial Field", city: "Philadelphia, PA", country: "USA", cc: "us", capacity: 69000 },
  "Kansas City": { stadium: "Arrowhead Stadium", city: "Kansas City, MO", country: "USA", cc: "us", capacity: 76000 },
  "Boston": { stadium: "Gillette Stadium", city: "Foxborough, MA", country: "USA", cc: "us", capacity: 65000 },
};

// Normalizacja klucza: lowercase, bez diakrytyków, bez nawiasów, zwarte spacje.
// Pozwala dopasować np. "Guadalajara (Zapopan)" czy "San Francisco Bay Area" do kluczy bazowych.
function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // usuń diakrytyki
    .replace(/\([^)]*\)/g, " ") // usuń nawiasy z zawartością
    .replace(/[^a-z0-9/ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Indeks znormalizowanych kluczy (budowany raz).
const NORM_INDEX: { key: string; norm: string; info: VenueInfo }[] = Object.entries(VENUES).map(
  ([key, info]) => ({ key, norm: norm(key), info })
);

/**
 * Dane stadionu dla wartości pola venue z bazy. Dopasowanie odporne:
 *  1) dokładne (po oryginalnym kluczu),
 *  2) po znormalizowanym kluczu,
 *  3) po fragmencie (znormalizowany klucz zawiera się w znormalizowanym venue lub odwrotnie).
 * null = brak dopasowania (np. mecz pucharowy bez ustalonego venue).
 */
export function venueInfo(venue?: string | null): VenueInfo | null {
  if (!venue) return null;
  if (VENUES[venue]) return VENUES[venue];

  const v = norm(venue);
  if (!v) return null;

  const exactNorm = NORM_INDEX.find((e) => e.norm === v);
  if (exactNorm) return exactNorm.info;

  // Dopasowanie po fragmencie — najdłuższy pasujący klucz wygrywa (precyzja > ogólność).
  let best: { info: VenueInfo; len: number } | null = null;
  for (const e of NORM_INDEX) {
    if (v.includes(e.norm) || e.norm.includes(v)) {
      if (!best || e.norm.length > best.len) best = { info: e.info, len: e.norm.length };
    }
  }
  return best?.info ?? null;
}
