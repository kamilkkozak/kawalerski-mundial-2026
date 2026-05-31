// Typy domenowe odpowiadające schematowi Postgres (patrz supabase/migrations).

export type Player = {
  id: string; // = auth.users.id
  name: string;
  email: string | null;
  is_admin: boolean;
};

export type Stage = "group" | "r32" | "r16" | "qf" | "sf" | "third" | "final";

export type MatchStatus = "SCHEDULED" | "IN_PLAY" | "PAUSED" | "FINISHED";

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
  status: MatchStatus;
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
};

export type Settings = {
  id: number;
  champion_result: string | null;
  top_scorer_result: string | null;
  settled_at: string | null;
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
