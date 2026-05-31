"use client";

import { avatarColor, initials } from "@/lib/ui";

// Awatar gracza: inicjały z nazwy + kolor z hasha id.
export default function Avatar({
  name,
  seed,
  size = 34,
}: {
  name: string;
  seed: string;
  size?: number;
}) {
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
