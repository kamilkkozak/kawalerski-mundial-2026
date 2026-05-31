"use client";

import { teamCode } from "@/lib/flags";

// Flaga drużyny: flagcdn SVG po nazwie z bazy; placeholder dla TBD/pucharu.
export default function Flag({
  name,
  className = "",
  ph,
}: {
  name?: string | null;
  className?: string;
  ph?: string;
}) {
  const code = teamCode(name);
  if (!code) {
    return <span className={`flag-ph ${className}`}>{ph ?? "TBD"}</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`flag ${className}`}
      src={`https://flagcdn.com/${code}.svg`}
      alt={name ?? ""}
      loading="lazy"
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
      }}
    />
  );
}
