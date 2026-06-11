// Kompresja awatara po stronie przeglądarki: walidacja -> center-crop 1:1 ->
// skalowanie do 400x400 -> webp (fallback jpeg). Bez zewnętrznych zależności.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB twardy limit wejścia
const TARGET = 400; // px (kwadrat)

export class ImageError extends Error {}

// Zwraca skompresowany Blob (webp/jpeg) gotowy do uploadu.
export async function processAvatarFile(file: File): Promise<Blob> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageError("Dozwolone formaty to JPG, PNG i WEBP.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ImageError("Plik jest za duży (maks. 8 MB).");
  }

  const bitmap = await loadBitmap(file);
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2; // center-crop
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = TARGET;
    canvas.height = TARGET;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Twoja przeglądarka nie obsługuje przetwarzania obrazu.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, TARGET, TARGET);

    let blob = await canvasToBlob(canvas, "image/webp", 0.85);
    if (!blob) blob = await canvasToBlob(canvas, "image/jpeg", 0.85); // fallback
    if (!blob) throw new ImageError("Nie udało się przetworzyć zdjęcia.");
    return blob;
  } finally {
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

type Drawable = ImageBitmap | HTMLImageElement;

async function loadBitmap(file: File): Promise<Drawable & { close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* spada do <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new ImageError("Nie udało się wczytać zdjęcia."));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}
