"use server";

import { createClient } from "@/lib/supabase/server";

// Mapuje techniczne błędy RPC na komunikaty po polsku.
function msg(code?: string): string {
  switch (code) {
    case "LOCKED":
      return "Typowanie tego meczu jest już zablokowane.";
    case "NOT_AUTHENTICATED":
      return "Musisz być zalogowany.";
    case "INVALID_SCORE":
      return "Nieprawidłowy wynik.";
    case "MATCH_NOT_FOUND":
      return "Nie znaleziono meczu.";
    case "NOT_ADMIN":
      return "Brak uprawnień administratora.";
    default:
      return code || "Coś poszło nie tak.";
  }
}

export type ActionResult = { ok: boolean; error?: string };

export async function savePrediction(
  matchId: number,
  p1: number,
  p2: number
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("upsert_prediction", {
    p_match_id: matchId,
    p1,
    p2,
  });
  if (error) return { ok: false, error: msg(error.message) };
  return { ok: true };
}

export async function saveBonus(champion: string, scorer: string): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_bonus", {
    p_champion: champion,
    p_scorer: scorer,
  });
  if (error) return { ok: false, error: msg(error.message) };
  return { ok: true };
}

export async function adminSetResult(
  matchId: number,
  s1: number | null,
  s2: number | null,
  status = "FINISHED"
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_result", {
    p_match_id: matchId,
    s1,
    s2,
    p_status: status,
  });
  if (error) return { ok: false, error: msg(error.message) };
  return { ok: true };
}

export async function adminSetBonusResult(
  champion: string,
  scorer: string
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_bonus_result", {
    p_champion: champion,
    p_scorer: scorer,
  });
  if (error) return { ok: false, error: msg(error.message) };
  return { ok: true };
}

export async function updateMyName(name: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };
  const { error } = await supabase
    .from("players")
    .update({ name: name.trim() })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
