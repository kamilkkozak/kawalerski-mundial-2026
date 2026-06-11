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
    case "NO_SCORER":
      return "Najpierw wybierz króla strzelców.";
    case "NO_CHAMPION":
      return "Najpierw wybierz mistrza świata.";
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

// Zatwierdzenie typu króla strzelców (trwała blokada — nie da się już zmienić).
export async function lockTopScorer(): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("lock_top_scorer");
  if (error) return { ok: false, error: msg(error.message) };
  return { ok: true };
}

// Zatwierdzenie typu mistrza świata (trwała blokada).
export async function lockChampion(): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("lock_champion");
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

// Ręczna obsada slotu pary pucharowej (admin). Blokuje slot — auto-logika go nie nadpisze.
export async function adminSetSlot(
  matchId: number,
  side: "home" | "away",
  team: string,
  flag?: string | null
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_slot", {
    p_match_id: matchId,
    p_side: side,
    p_team: team,
    p_flag: flag ?? null,
  });
  if (error) return { ok: false, error: msg(error.message) };
  return { ok: true };
}

// Wyczyszczenie slotu (powrót do TBD / auto-obsady).
export async function adminClearSlot(
  matchId: number,
  side: "home" | "away"
): Promise<ActionResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_clear_slot", {
    p_match_id: matchId,
    p_side: side,
  });
  if (error) return { ok: false, error: msg(error.message) };
  return { ok: true };
}

// Zapis avatar_url własnego wiersza. url = null czyści awatar (powrót do inicjałów).
// Akceptuje tylko ścieżkę gotowca (/avatars/...) albo Storage URL bucketa 'avatars'.
export async function updateMyAvatar(url: string | null): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };

  let value: string | null = null;
  if (url) {
    const ok = url.startsWith("/avatars/") || url.includes("/avatars/");
    if (!ok) return { ok: false, error: "Nieprawidłowy awatar." };
    value = url;
  }

  const { error } = await supabase.from("players").update({ avatar_url: value }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateMyName(name: string): Promise<ActionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Musisz być zalogowany." };
  const clean = name.trim();
  if (clean.length < 2) return { ok: false, error: "Nazwa musi mieć min. 2 znaki." };
  if (clean.length > 40) return { ok: false, error: "Nazwa może mieć maks. 40 znaków." };
  const { error } = await supabase
    .from("players")
    .update({ name: clean })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
