// Awatary: lista gotowców (public/avatars) + helpery ścieżek Storage.

// Gotowe awatary leżą statycznie w repo (public/avatars/*.svg).
// Wybór ustawia players.avatar_url na taką właśnie ścieżkę (bez uploadu do Storage).
export const PRESET_AVATARS: string[] = [
  "/avatars/01-ball.svg",
  "/avatars/02-jersey.svg",
  "/avatars/03-trophy.svg",
  "/avatars/04-whistle.svg",
  "/avatars/05-boot.svg",
  "/avatars/06-star.svg",
  "/avatars/07-flag.svg",
  "/avatars/08-goal.svg",
  "/avatars/09-fan.svg",
  "/avatars/10-bolt.svg",
  "/avatars/11-crown.svg",
  "/avatars/12-shield.svg",
];

export const AVATAR_BUCKET = "avatars";

// Stała ścieżka pliku per user w Storage (folder = player_id -> RLS po auth.uid()).
export function avatarStoragePath(playerId: string): string {
  return `${playerId}/avatar.webp`;
}

// Czy dany avatar_url to wgrane zdjęcie ze Storage (a nie gotowiec z /avatars/...).
export function isUploadedAvatar(url: string | null | undefined): boolean {
  return !!url && url.includes(`/${AVATAR_BUCKET}/`);
}
