"use client";

import { useEffect, useMemo, useState } from "react";
import type { Match, PredMap } from "@/lib/types";
import { isLocked, lockAtMs } from "@/lib/scoring";
import { fmtDay, fmtCountdown } from "@/lib/ui";
import MatchCard from "./MatchCard";

export default function MatchList({
  matches,
  preds,
  now,
  onOpenMatch,
}: {
  matches: Match[];
  preds: PredMap;
  now: number;
  onOpenMatch: (m: Match) => void;
}) {
  // Odliczanie zależy od bieżącego czasu — renderujemy je dopiero po zamontowaniu,
  // żeby SSR i hydracja nie różniły się sekundami (Next hydration mismatch).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const byDay = useMemo(() => {
    const map: Record<string, Match[]> = {};
    matches
      .filter((m) => m.stage === "group")
      .forEach((m) => {
        const k = m.kickoff.slice(0, 10);
        (map[k] ||= []).push(m);
      });
    return Object.keys(map)
      .sort()
      .map((k) => ({ key: k, list: map[k].sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff)) }));
  }, [matches]);

  return (
    <div>
      {byDay.map((day) => {
        let cls = "open";
        let txt = "";
        if (mounted) {
          const open = day.list.filter((m) => !isLocked(m.kickoff, now));
          const live = day.list.some((m) => m.status === "IN_PLAY" || m.status === "PAUSED");
          if (live) {
            cls = "live";
            txt = "Trwają mecze";
          } else if (open.length === 0) {
            cls = "closed";
            txt = "Typy zamknięte";
          } else {
            const nextLock = Math.min(...open.map((m) => lockAtMs(m.kickoff)));
            txt = `Najbliższe zamknięcie za ${fmtCountdown(nextLock - now)}`;
          }
        }
        return (
          <div className="day-block" key={day.key}>
            <div className="day-head">
              <span className="dd">
                {fmtDay(day.key + "T12:00:00")}
              </span>
              <span className={`day-deadline ${cls}`} suppressHydrationWarning>{txt}</span>
            </div>
            <div className="matches">
              {day.list.map((m) => (
                <MatchCard key={m.id} match={m} pred={preds[m.id]} now={now} onOpen={() => onOpenMatch(m)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
