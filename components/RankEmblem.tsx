"use client";

// Emblematy rang — nowy design: szklany heksagon, korona królewska, moneta z numerem miejsca.
// TOP 3: złoto/srebro/brąz + korona. Rank 4+: wariant stalowy bez korony.
// Animacje w globals.css (.breathe .emb-logo / .emb-flash / .emb-gem*).

type TierKey = "gold" | "silver" | "bronze" | "steel";

type Tier = {
  pDark: string; pMid: string; pLight: string;
  spDark: string; spMid: string; spLight: string;
  gemD: string; gemM: string; gemL: string;
  energy: string; glow: string; halo: string;
};

const TIERS: Record<TierKey, Tier> = {
  gold:   { pDark:"#6a4710", pMid:"#d8a52e", pLight:"#ffe9a8", spDark:"#7a5512", spMid:"#f2c24a", spLight:"#fff3c8", gemD:"#a5781f", gemM:"#ffd45a", gemL:"#fff6d8", energy:"#ffe07a", glow:"#ffcf5a", halo:"rgba(255,200,80,.30)" },
  silver: { pDark:"#525c6b", pMid:"#aab7c8", pLight:"#ffffff", spDark:"#5e6878", spMid:"#cdd8e6", spLight:"#ffffff", gemD:"#6b7686", gemM:"#e6eef8", gemL:"#ffffff", energy:"#dceaf7", glow:"#c4dcf0", halo:"rgba(200,225,250,.34)" },
  bronze: { pDark:"#5a2a14", pMid:"#b5642f", pLight:"#ffc089", spDark:"#6b3318", spMid:"#cf7a3e", spLight:"#ffd6ad", gemD:"#8a3f1c", gemM:"#ff9a52", gemL:"#ffd9b8", energy:"#ff9a4d", glow:"#ff7a36", halo:"rgba(255,130,60,.28)" },
  steel:  { pDark:"#262f3b", pMid:"#4e5a69", pLight:"#92a0b0", spDark:"#2e3845", spMid:"#6b7888", spLight:"#aab6c6", gemD:"#445062", gemM:"#8a98a8", gemL:"#c2cedd", energy:"#8b9aab", glow:"#5d6c7d", halo:"rgba(110,128,150,.20)" },
};

function hx(h: string) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function mix(a1: string, b1: string, t: number) { const a = hx(a1), b = hx(b1); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }

function hexLogo(t: Tier, id: string): string {
  return `<g transform="translate(-32,-32)">`
    + `<path d="M32 2.5 56 16v32L32 61.5 8 48V16L32 2.5Z" fill="url(#${id}body)" stroke="${t.pLight}" stroke-width="1.2" stroke-linejoin="round"/>`
    + `<path d="M32 2.5 56 16 32 32 8 16Z" fill="url(#${id}sheen)" opacity="0.55"/>`
    + `<path d="M32 7 51.5 18v28L32 57 12.5 46V18L32 7Z" fill="none" stroke="${t.pLight}" stroke-opacity="0.32" stroke-width="0.7"/>`
    + `<g transform="translate(0,8.5) translate(32,21) scale(0.8) translate(-32,-21)" stroke="${t.pLight}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none">`
    + `<path d="M25 15h14v5a7 7 0 0 1-14 0v-5Z"/>`
    + `<path d="M39 16.5h4.5v2.2a3.2 3.2 0 0 1-3.2 3.2M25 16.5h-4.5v2.2a3.2 3.2 0 0 0 3.2 3.2"/>`
    + `<path d="M32 27v3.4M28.5 33h7"/>`
    + `</g>`
    + `<text x="32" y="48" text-anchor="middle" font-family="Anton, sans-serif" font-size="14" letter-spacing="-0.3" fill="${t.pLight}">26</text>`
    + `</g>`;
}

const CROWN_TIPS: [number, number][] = [[-33, -50], [-17, -49], [0, -54], [17, -49], [33, -50]];

function emblem(key: TierKey, id: string, size: number, withCrown: boolean, place: number): string {
  const t = TIERS[key];
  let defs = "";

  defs += `<linearGradient id="${id}body" x1="0" y1="-30" x2="0" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.pLight}" stop-opacity="0.34"/><stop offset="0.5" stop-color="${t.pMid}" stop-opacity="0.22"/><stop offset="1" stop-color="${t.pDark}" stop-opacity="0.5"/></linearGradient>`;
  defs += `<linearGradient id="${id}sheen" x1="-22" y1="-30" x2="10" y2="6" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  defs += `<radialGradient id="${id}flash" cx="0" cy="-2" r="44" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.spLight}" stop-opacity="0.85"/><stop offset="0.45" stop-color="${t.energy}" stop-opacity="0.45"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>`;
  defs += `<linearGradient id="${id}crown" x1="0" y1="-73" x2="0" y2="-15" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.pLight}"/><stop offset="0.5" stop-color="${t.pMid}"/><stop offset="1" stop-color="${mix(t.pMid, t.pDark, 0.55)}"/></linearGradient>`;
  defs += `<radialGradient id="${id}coin" cx="0" cy="-50" r="22" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${mix(t.pDark, t.pMid, 0.5)}"/><stop offset="1" stop-color="${t.pDark}"/></radialGradient>`;
  defs += `<radialGradient id="${id}gemglow"><stop offset="0" stop-color="${t.spLight}" stop-opacity="0.9"/><stop offset="0.5" stop-color="${t.energy}" stop-opacity="0.4"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>`;

  const flash = `<g class="emb-flash"><circle cx="0" cy="-2" r="44" fill="url(#${id}flash)"/></g>`;

  let crown = "";
  if (withCrown) {
    crown = `<g class="emb-crown">`
      + `<path d="M-36,-22 L-33,-50 Q-25,-27 -17,-49 Q-8.5,-34 0,-54 Q8.5,-34 17,-49 Q25,-27 33,-50 L36,-22 L0,-42 Z" fill="url(#${id}crown)" stroke="${t.pDark}" stroke-width="1" stroke-linejoin="round"/>`;
    for (const [x, y] of CROWN_TIPS) crown += `<circle class="emb-gemglow" cx="${x}" cy="${y}" r="1.25" fill="url(#${id}gemglow)"/>`;
    for (const [x, y] of CROWN_TIPS) crown += `<circle class="emb-gem" cx="${x}" cy="${y}" r="0.5" fill="#fff"/>`;
    crown += `</g>`;
  }

  const coin = `<g class="emb-coin">`
    + `<circle cx="0" cy="-30" r="13.5" fill="url(#${id}coin)" stroke="${t.pLight}" stroke-width="2"/>`
    + `<circle cx="0" cy="-30" r="10" fill="none" stroke="${t.pMid}" stroke-width="1" opacity="0.5"/>`
    + `<path d="M-8.5,-35 A11.5 11.5 0 0 1 8.5,-35" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity="0.3"/>`
    + `<text x="0" y="-24.4" text-anchor="middle" font-family="Anton, sans-serif" font-size="17" fill="${t.pLight}">${place}</text>`
    + `</g>`;

  return `<svg class="emb" viewBox="-74 -78 148 158" width="${size}" height="${Math.round(size * 158 / 148)}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">`
    + `<defs>${defs}</defs>`
    + flash
    + `<g class="emb-logo">${crown}<g transform="scale(1.5)">${hexLogo(t, id)}</g>${coin}</g>`
    + `</svg>`;
}

export default function RankEmblem({ rank, size = 48 }: { rank: number; size?: number }) {
  const key: TierKey = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "steel";
  const html = emblem(key, `re${rank}-`, size, rank <= 3, rank);
  return <span className="rank-emb breathe" aria-hidden dangerouslySetInnerHTML={{ __html: html }} />;
}
