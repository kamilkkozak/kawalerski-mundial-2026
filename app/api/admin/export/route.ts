import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/ui";

export const dynamic = "force-dynamic";

// Punkty za pojedynczy typ (zgodnie z get_standings: 3 = dokładny, 1 = poprawny wynik, 0).
function predPoints(p1: number, p2: number, s1: number | null, s2: number | null): number | null {
  if (s1 == null || s2 == null) return null;
  if (p1 === s1 && p2 === s2) return 3;
  if (Math.sign(p1 - p2) === Math.sign(s1 - s2)) return 1;
  return 0;
}

export async function GET() {
  // 1) tylko zalogowany admin
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const { data: meRow } = await supabase.from("players").select("is_admin").eq("id", user.id).single();
  if (!meRow?.is_admin) return NextResponse.json({ error: "NOT_ADMIN" }, { status: 403 });

  // 2) pełny odczyt przez service_role (omija RLS — bierzemy WSZYSTKIE typy/bonusy)
  const admin = createServiceClient();
  const [playersRes, matchesRes, predsRes, bonusRes, settingsRes, standingsRes] = await Promise.all([
    admin.from("players").select("*").order("name"),
    admin.from("matches").select("*").order("kickoff"),
    admin.from("predictions").select("*"),
    admin.from("bonus_picks").select("*"),
    admin.from("settings").select("*").eq("id", 1).single(),
    admin.rpc("get_standings"),
  ]);

  const players = playersRes.data ?? [];
  const matches = matchesRes.data ?? [];
  const preds = predsRes.data ?? [];
  const bonuses = bonusRes.data ?? [];
  const settings = settingsRes.data ?? null;
  const standings = standingsRes.data ?? [];

  const playerName = new Map(players.map((p: any) => [p.id, p.name]));
  const matchById = new Map(matches.map((m: any) => [m.id, m]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Kawalerski Mundial 2026";
  wb.created = new Date();

  const addSheet = (name: string, columns: { header: string; key: string; width: number }[], rows: any[]) => {
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.columns = columns;
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: "middle" };
    rows.forEach((r) => ws.addRow(r));
    return ws;
  };

  // Ranking
  addSheet("Ranking",
    [
      { header: "Miejsce", key: "rank", width: 9 },
      { header: "Gracz", key: "name", width: 22 },
      { header: "Punkty", key: "points", width: 9 },
      { header: "Trafienia dokładne (3 pkt)", key: "exact", width: 24 },
      { header: "Trafienia wyniku (1 pkt)", key: "hits", width: 22 },
      { header: "Bonus", key: "bonus", width: 9 },
    ],
    standings.map((s: any, i: number) => ({
      rank: i + 1, name: s.name, points: Number(s.points),
      exact: Number(s.exact_hits), hits: Number(s.result_hits), bonus: Number(s.bonus_points),
    }))
  );

  // Typy meczowe (NAJWAŻNIEJSZE — dane nieodtwarzalne)
  addSheet("Typy meczowe",
    [
      { header: "Gracz", key: "player", width: 20 },
      { header: "Mecz", key: "match", width: 30 },
      { header: "Etap", key: "stage", width: 8 },
      { header: "Grupa", key: "group", width: 7 },
      { header: "Data", key: "kickoff", width: 17 },
      { header: "Typ", key: "pred", width: 8 },
      { header: "Wynik", key: "result", width: 8 },
      { header: "Punkty", key: "pts", width: 8 },
    ],
    preds
      .map((p: any) => {
        const m: any = matchById.get(p.match_id);
        const pts = m ? predPoints(p.pred1, p.pred2, m.score1, m.score2) : null;
        return {
          player: playerName.get(p.player_id) ?? p.player_id,
          match: m ? `${m.team1} – ${m.team2}` : `#${p.match_id}`,
          stage: m?.stage ?? "",
          group: m?.group_label ?? "",
          kickoff: m ? fmtDateTime(m.kickoff) : "",
          pred: `${p.pred1}:${p.pred2}`,
          result: m && m.score1 != null ? `${m.score1}:${m.score2}` : "—",
          pts: pts == null ? "" : pts,
          _k: m ? +new Date(m.kickoff) : 0,
        };
      })
      .sort((a: any, b: any) => a.player.localeCompare(b.player) || a._k - b._k)
  );

  // Bonusy
  addSheet("Bonusy",
    [
      { header: "Gracz", key: "player", width: 20 },
      { header: "Mistrz świata (typ)", key: "champion", width: 22 },
      { header: "Król strzelców (typ)", key: "scorer", width: 24 },
    ],
    bonuses
      .map((b: any) => ({
        player: playerName.get(b.player_id) ?? b.player_id,
        champion: b.champion ?? "",
        scorer: b.top_scorer ?? "",
      }))
      .sort((a: any, b: any) => a.player.localeCompare(b.player))
  );

  // Mecze
  addSheet("Mecze",
    [
      { header: "Id", key: "id", width: 7 },
      { header: "Etap", key: "stage", width: 8 },
      { header: "Grupa", key: "group", width: 7 },
      { header: "Data", key: "kickoff", width: 17 },
      { header: "Gospodarz", key: "team1", width: 18 },
      { header: "Gość", key: "team2", width: 18 },
      { header: "Wynik", key: "score", width: 8 },
      { header: "Status", key: "status", width: 11 },
    ],
    matches.map((m: any) => ({
      id: m.id, stage: m.stage, group: m.group_label ?? "", kickoff: fmtDateTime(m.kickoff),
      team1: m.team1, team2: m.team2,
      score: m.score1 != null ? `${m.score1}:${m.score2}` : "—", status: m.status,
    }))
  );

  // Gracze (z id — do ewentualnego odtworzenia powiązań)
  addSheet("Gracze",
    [
      { header: "Id (uuid)", key: "id", width: 38 },
      { header: "Nazwa", key: "name", width: 22 },
      { header: "E-mail", key: "email", width: 28 },
      { header: "Admin", key: "admin", width: 8 },
      { header: "Utworzono", key: "created", width: 17 },
    ],
    players.map((p: any) => ({
      id: p.id, name: p.name, email: p.email ?? "", admin: p.is_admin ? "tak" : "",
      created: p.created_at ? fmtDateTime(p.created_at) : "",
    }))
  );

  // Ustawienia (wynik bonusów)
  addSheet("Ustawienia",
    [
      { header: "Mistrz świata (wynik)", key: "champion", width: 24 },
      { header: "Król strzelców (wynik)", key: "scorer", width: 26 },
      { header: "Rozliczono", key: "settled", width: 18 },
    ],
    settings ? [{
      champion: settings.champion_result ?? "",
      scorer: settings.top_scorer_result ?? "",
      settled: settings.settled_at ? fmtDateTime(settings.settled_at) : "",
    }] : []
  );

  const buf = await wb.xlsx.writeBuffer();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fname = `kawalerski-mundial-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "no-store",
    },
  });
}
