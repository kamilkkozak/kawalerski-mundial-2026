import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCoverage } from "@/lib/apifootball";

export const dynamic = "force-dynamic";

// Jednorazowa weryfikacja coverage API-Football dla league=1&season=2026.
// Robi DOKŁADNIE 1 zapytanie. Tylko dla admina (otwórz w przeglądarce zalogowany).
export async function GET() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "missing API_FOOTBALL_KEY" }, { status: 500 });
  }

  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: me } = await supabase.from("players").select("is_admin").eq("id", auth.user.id).single();
  if (!me?.is_admin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const cov = await fetchCoverage(apiKey);
  return NextResponse.json(cov);
}
