"use client";

import { avatarColor, initials } from "@/lib/ui";

// Awatar gracza. Gdy avatarUrl jest podane -> zdjęcie/gotowiec jako tło (cover).
// Gdy puste -> fallback: inicjały z nazwy na kolorze deterministycznym z id.
export default function Avatar({
  name,
  seed,
  size = 34,
  avatarUrl,
}: {
  name: string;
  seed: string;
  size?: number;
  avatarUrl?: string | null;
}) {
  if (avatarUrl) {
    return (
      <span
        className="avatar avatar-img"
        role="img"
        aria-label={name}
        style={{
          width: size,
          height: size,
          backgroundImage: `url(${JSON.stringify(avatarUrl)})`,
        }}
      />
    );
  }

  const color = avatarColor(seed);
  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, #000))`,
      }}
    >
      {initials(name)}
    </span>
  );
}
