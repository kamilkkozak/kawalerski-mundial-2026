import { createHmac } from "crypto";

// Logowanie po nazwie LUB e-mailu + PIN. Pod spodem zostaje Supabase Auth:
//  - e-mail (prawdziwy) = identyfikator konta w auth.users,
//  - PIN = hasło, rozciągane przez HMAC(AUTH_SECRET) do 64 znaków hex (krótki PIN
//    spełnia minimalną długość Supabase, a surowy PIN nigdzie nie jest przechowywany).
// Logowanie po nazwie działa, bo nazwa jest UNIKALNA i mapuje się na e-mail (players.email).
//
// UWAGA: AUTH_SECRET musi być stały — jego zmiana unieważnia wszystkie PIN-y.

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateName(raw: string): string | null {
  const n = raw.trim();
  if (n.length < 2) return "Nazwa musi mieć co najmniej 2 znaki.";
  if (n.length > 24) return "Nazwa może mieć maksymalnie 24 znaki.";
  if (n.includes("@")) return "Nazwa nie może zawierać znaku @.";
  return null;
}

export function validateEmail(raw: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim())) return "Podaj poprawny adres e-mail.";
  return null;
}

export function validatePin(pin: string): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "PIN musi mieć od 4 do 6 cyfr.";
  return null;
}

// PIN -> hasło Supabase. Deterministyczne, więc logowanie odtwarza je z samego PIN-u.
export function passwordFromPin(pin: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHmac("sha256", secret).update(pin, "utf8").digest("hex");
}
