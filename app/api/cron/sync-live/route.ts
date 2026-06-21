import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { syncLiveScores } from "@/lib/varzesh3";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Lekki cron LIVE: pobiera wyniki na żywo MŚ z Varzesh3 i aktualizuje mecze IN_PLAY.
// Niezależny od sync-results (football-data) — może być wołany częściej (np. co 1–2 min
// w trakcie meczów). Zabezpieczony nagłówkiem Authorization: Bearer <CRON_SECRET>.
//
// ?dry=1 — tryb podglądu: nic nie zapisuje, zwraca raport porównawczy (Varzesh3 vs baza).
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  const supabase = createServiceClient();
  try {
    const summary = await syncLiveScores(supabase, { dryRun });
    return NextResponse.json({ ok: true, dryRun, ...summary });
  } catch (e) {
    // Geo-blok / zmiana formatu / timeout — nie wywalamy, zwracamy info.
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
