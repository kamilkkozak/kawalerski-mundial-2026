"use server";

import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import {
  normalizeEmail,
  normalizeName,
  passwordFromPin,
  validateEmail,
  validateName,
  validatePin,
} from "@/lib/auth";

export type AuthState = { error?: string };

// --- Rejestracja: nazwa + e-mail + PIN (z powtórzeniem) ----------------
export async function signUpAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("username") ?? "");
  const email = String(formData.get("email") ?? "");
  const pin = String(formData.get("pin") ?? "");
  const pin2 = String(formData.get("pin2") ?? "");

  const invalid = validateName(name) || validateEmail(email) || validatePin(pin);
  if (invalid) return { error: invalid };
  if (pin !== pin2) return { error: "PIN-y nie są takie same." };

  const normName = normalizeName(name);
  const normEmail = normalizeEmail(email);
  const admin = createServiceClient();

  // Nazwa musi być unikalna (logujemy się też po nazwie). Grupa mała -> porównanie w JS.
  const { data: players } = await admin.from("players").select("name");
  if ((players ?? []).some((p) => normalizeName(p.name) === normName)) {
    return { error: "Ta nazwa jest już zajęta — wybierz inną." };
  }

  const { error } = await admin.auth.admin.createUser({
    email: normEmail,
    password: passwordFromPin(pin),
    email_confirm: true, // od razu potwierdzone, bez wysyłki maila
    user_metadata: { name: name.trim() },
  });
  if (error) {
    if (/already|exist|registered|duplicate/i.test(error.message)) {
      return { error: "Ten e-mail jest już zarejestrowany — przełącz się na logowanie." };
    }
    return { error: error.message };
  }

  const supabase = createClient();
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: normEmail,
    password: passwordFromPin(pin),
  });
  if (signInErr) return { error: signInErr.message };

  redirect("/");
}

// --- Logowanie: nazwa LUB e-mail + PIN ---------------------------------
export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const identifier = String(formData.get("identifier") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");

  if (!identifier) return { error: "Podaj nazwę lub e-mail." };
  if (validatePin(pin)) return { error: "PIN musi mieć od 4 do 6 cyfr." };

  let email: string | null = null;
  if (identifier.includes("@")) {
    email = normalizeEmail(identifier);
  } else {
    // Nazwa -> e-mail konta (lookup przez service_role, bo user nie jest jeszcze zalogowany).
    const admin = createServiceClient();
    const { data: players } = await admin.from("players").select("name, email");
    const norm = normalizeName(identifier);
    email = (players ?? []).find((p) => normalizeName(p.name) === norm)?.email ?? null;
    if (!email) return { error: "Nie ma konta o tej nazwie." };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: passwordFromPin(pin),
  });
  if (error) return { error: "Błędna nazwa / e-mail lub PIN." };

  redirect("/");
}
