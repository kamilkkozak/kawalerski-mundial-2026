// Typy domenowe odpowiadające schematowi Postgres (patrz supabase/migrations).

export type Player = {
  id: string; // = auth.users.id
  name: string;
  email: string | null;
  is_admin: boolean;
  avatar_url: string | null; // URL/ścieżka awatara (Storage public URL lub /avatars/*.svg)
};

export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";

export type MatchStatus = "SCHEDULED" | "TIMED" | "IN_PLAY" | "PAUSED" | "FINISHED";

export type Match = {
  id: number;
  ext_id: number | null; // id z football-data.org (do auto-sync)
  stage: Stage;
  group_label: string | null; // "A".."L" dla fazy grupowej
  kickoff: string; // ISO timestamptz (UTC)
  team1: string;
  team2: string;
  flag1: string | null;
  flag2: string | null;
  venue: string | null;
  score1: number | null;
  score2: number | null;
  attendance: number | null; // frekwencja — dociągana z API po meczu (null gdy brak)
  status: MatchStatus;
  // Faza pucharowa (null dla meczów grupowych):
  bracket_code: string | null; // "M73".."M104"
  home_ref: string | null; // deskryptor slotu: "2A" / "1E" / "3/ABCDF" / "W73" / "L101"
  away_ref: string | null;
  home_locked: boolean; // ręczna obsada admina — auto-logika nie nadpisuje
  away_locked: boolean;
  updated_at: string; // ISO timestamp ostatniej zmiany wiersza (auto-sync / admin)
};

export type Prediction = {
  player_id: string;
  match_id: number;
  pred1: number;
  pred2: number;
  created_at: string;
  updated_at: string;
};

export type BonusPick = {
  player_id: string;
  champion: string | null;
  top_scorer: string | null;
  champion_locked: boolean; // gracz zatwierdził typ mistrza świata (trwała blokada)
  top_scorer_locked: boolean; // gracz zatwierdził typ króla strzelców (trwała blokada)
};

export type Settings = {
  id: number;
  champion_result: string | null;
  top_scorer_result: string | null;
  settled_at: string | null;
  scorers_synced_at: string | null; // ostatnia synchronizacja /scorers
  top_scorer_source: "auto" | "admin" | null; // kto rozstrzygnął bonus strzelca
  top_scorer_review: boolean; // remis na 1. miejscu — wymaga decyzji admina
};

// Wiersz klasyfikacji strzelców (z football-data.org /scorers).
export type Scorer = {
  player_name: string;
  rank: number | null;
  team: string | null; // polska nazwa (zmapowana) lub oryginał
  team_en: string | null; // oryginał z API (do flagi)
  goals: number;
  assists: number | null;
  updated_at: string;
};

export type Team = { name: string; flag: string };

export type StandingRow = {
  player_id: string;
  name: string;
  points: number;
  exact: number;
  hits: number;
  bonus_points: number;
};

// Mapa typów zalogowanego gracza: match_id -> wynik.
export type PredMap = Record<number, { pred1: number; pred2: number }>;
