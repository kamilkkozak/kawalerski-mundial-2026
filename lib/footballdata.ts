// Mapowanie nazw drużyn football-data.org (angielskie) -> nasze (polskie).
// Używane przy auto-linkowaniu meczów, gdy w jednym slocie czasowym jest >1 mecz.
// Po starcie turnieju zweryfikuj realne nazwy z API i w razie potrzeby dopisz aliasy.
export const FD_TO_PL: Record<string, string> = {
  "Algeria": "Algieria",
  "England": "Anglia",
  "Saudi Arabia": "Arabia Saud.",
  "Argentina": "Argentyna",
  "Australia": "Australia",
  "Austria": "Austria",
  "Belgium": "Belgia",
  "Bosnia and Herzegovina": "Bośnia",
  "Bosnia & Herzegovina": "Bośnia",
  "Bosnia-Herzegovina": "Bośnia",
  "Brazil": "Brazylia",
  "Croatia": "Chorwacja",
  "Curaçao": "Curaçao",
  "Curacao": "Curaçao",
  "Czechia": "Czechy",
  "Czech Republic": "Czechy",
  "DR Congo": "DR Konga",
  "Congo DR": "DR Konga",
  "Democratic Republic of the Congo": "DR Konga",
  "Egypt": "Egipt",
  "Ecuador": "Ekwador",
  "France": "Francja",
  "Ghana": "Ghana",
  "Haiti": "Haiti",
  "Spain": "Hiszpania",
  "Netherlands": "Holandia",
  "Iraq": "Irak",
  "Iran": "Iran",
  "IR Iran": "Iran",
  "Japan": "Japonia",
  "Jordan": "Jordania",
  "Canada": "Kanada",
  "Qatar": "Katar",
  "Colombia": "Kolumbia",
  "South Korea": "Korea Płd.",
  "Korea Republic": "Korea Płd.",
  "Republic of Korea": "Korea Płd.",
  "Morocco": "Maroko",
  "Mexico": "Meksyk",
  "Germany": "Niemcy",
  "Norway": "Norwegia",
  "New Zealand": "Nowa Zelandia",
  "Panama": "Panama",
  "Paraguay": "Paragwaj",
  "Portugal": "Portugalia",
  "South Africa": "RPA",
  "Cape Verde": "Rep. Ziel. Przylądka",
  "Cabo Verde": "Rep. Ziel. Przylądka",
  "Cape Verde Islands": "Rep. Ziel. Przylądka",
  "Senegal": "Senegal",
  "Scotland": "Szkocja",
  "Switzerland": "Szwajcaria",
  "Sweden": "Szwecja",
  "Tunisia": "Tunezja",
  "Turkey": "Turcja",
  "Türkiye": "Turcja",
  "United States": "USA",
  "USA": "USA",
  "Uruguay": "Urugwaj",
  "Uzbekistan": "Uzbekistan",
  "Ivory Coast": "Wyb. K. Słoniowej",
  "Côte d'Ivoire": "Wyb. K. Słoniowej",
  "Cote d'Ivoire": "Wyb. K. Słoniowej",
};

export function toPl(name?: string | null): string | null {
  if (!name) return null;
  return FD_TO_PL[name] ?? name;
}

// Statusy football-data.org -> nasze.
export function mapStatus(s: string): "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED" {
  switch (s) {
    case "IN_PLAY":
      return "IN_PLAY";
    case "PAUSED":
      return "PAUSED";
    case "FINISHED":
    case "AWARDED":
      return "FINISHED";
    case "TIMED":
      return "TIMED";
    default:
      return "SCHEDULED";
  }
}

export type FdMatch = {
  id: number;
  utcDate: string;
  status: string;
  homeTeam: { name: string };
  awayTeam: { name: string };
  // winner uwzględnia rozstrzygnięcie po dogrywce/karnych (do progresji w drabince).
  score: {
    fullTime: { home: number | null; away: number | null };
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
  };
  attendance?: number | null; // frekwencja (dostępna po meczu)
};

// /v4/competitions/WC/scorers — czołówka strzelców (darmowy plan: ~top 10, z opóźnieniem).
export type FdScorer = {
  player?: { id?: number; name?: string } | null;
  team?: { id?: number; name?: string } | null;
  goals?: number | null;
  assists?: number | null;
};
