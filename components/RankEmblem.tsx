"use client";

// Emblemat rangi TOP 3 — medalowe (1 złoto / 2 srebro / 3 brąz) z energią:
// świecący rdzeń, łuki energii na skrzydłach, iskry, animowany połysk.
// Port designu referencyjnego (własna grafika SVG). Animacje w globals.css (.rank-emb ...).

type TierKey = "gold" | "silver" | "bronze";

type Tier = {
  pDark: string; pMid: string; pLight: string;
  spDark: string; spMid: string; spLight: string;
  gemD: string; gemM: string; gemL: string;
  energy: string; glow: string; halo: string;
};

const TIERS: Record<TierKey, Tier> = {
  gold:   { pDark:"#6a4710", pMid:"#d8a52e", pLight:"#ffe9a8", spDark:"#7a5512", spMid:"#f2c24a", spLight:"#fff3c8", gemD:"#a5781f", gemM:"#ffd45a", gemL:"#fff6d8", energy:"#ffe07a", glow:"#ffcf5a", halo:"rgba(255,200,80,.30)" },
  silver: { pDark:"#39414f", pMid:"#8d98a9", pLight:"#f1f5fb", spDark:"#4a5260", spMid:"#aab6c6", spLight:"#ffffff", gemD:"#5d6b7e", gemM:"#cfe0f2", gemL:"#ffffff", energy:"#8fe0ff", glow:"#7fd0ff", halo:"rgba(140,210,255,.30)" },
  bronze: { pDark:"#5a2a14", pMid:"#b5642f", pLight:"#ffc089", spDark:"#6b3318", spMid:"#cf7a3e", spLight:"#ffd6ad", gemD:"#8a3f1c", gemM:"#ff9a52", gemL:"#ffd9b8", energy:"#ff9a4d", glow:"#ff7a36", halo:"rgba(255,130,60,.28)" },
};

const P = [0, 58];
const TOP = [[6, -6], [20, -12], [36, -16], [50, -18]];
const WING = { base: [[26, -13], [44, -17]], tip: [64, -54], back: [36, -15], ctrlUp: [60, -44], ctrlBack: [48, -30] };
const INNERSPIKE = { base: [8, -12], out: [16, -14], tip: [19, -42] };

function hx(h: string) { h = h.replace("#", ""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function mix(a1: string, b1: string, t: number) { const a = hx(a1), b = hx(b1); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }

function emblem(key: TierKey, id: string, size: number): string {
  const t = TIERS[key];
  let defs = "", plates = "";
  for (let i = 0; i < 3; i++) {
    const a = TOP[i], b = TOP[i + 1];
    const bright = i === 0 ? 1 : i === 1 ? 0.66 : 0.4;
    const top = mix(t.pMid, t.pLight, bright), bot = t.pDark;
    const gid = `${id}p${i}`;
    defs += `<linearGradient id="${gid}" x1="0" y1="-18" x2="0" y2="58" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${top}"/><stop offset="0.55" stop-color="${t.pMid}"/><stop offset="1" stop-color="${bot}"/></linearGradient>`;
    plates += `<path d="M${a} L${b} L${P} Z" fill="url(#${gid})" stroke="${t.pDark}" stroke-width="0.7" stroke-linejoin="round"/>`;
    plates += `<path d="M${-a[0]},${a[1]} L${-b[0]},${b[1]} L${P} Z" fill="url(#${gid})" stroke="${t.pDark}" stroke-width="0.7" stroke-linejoin="round"/>`;
  }
  const wing = (sign: number) => {
    const b0 = [WING.base[0][0] * sign, WING.base[0][1]], b1 = [WING.base[1][0] * sign, WING.base[1][1]];
    const tip = [WING.tip[0] * sign, WING.tip[1]], cu = [WING.ctrlUp[0] * sign, WING.ctrlUp[1]], cb = [WING.ctrlBack[0] * sign, WING.ctrlBack[1]], back = [WING.back[0] * sign, WING.back[1]];
    return `M${b0} L${b1} Q${cu} ${tip} Q${cb} ${back} Z`;
  };
  const innerSpike = (sign: number) => {
    const bs = [INNERSPIKE.base[0] * sign, INNERSPIKE.base[1]], o = [INNERSPIKE.out[0] * sign, INNERSPIKE.out[1]], tp = [INNERSPIKE.tip[0] * sign, INNERSPIKE.tip[1]];
    return `M${bs} L${o} L${tp} Z`;
  };
  defs += `<linearGradient id="${id}wg" x1="0" y1="-54" x2="0" y2="-10" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.pLight}"/><stop offset="0.6" stop-color="${t.pMid}"/><stop offset="1" stop-color="${t.pDark}"/></linearGradient>`;
  defs += `<linearGradient id="${id}sp" x1="0" y1="-58" x2="0" y2="48" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.spLight}"/><stop offset="0.45" stop-color="${t.spMid}"/><stop offset="1" stop-color="${t.spDark}"/></linearGradient>`;
  defs += `<linearGradient id="${id}gm" x1="0" y1="-12" x2="0" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.gemL}"/><stop offset="0.5" stop-color="${t.gemM}"/><stop offset="1" stop-color="${t.gemD}"/></linearGradient>`;
  defs += `<radialGradient id="${id}core" cx="0" cy="8" r="42" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0.95"/><stop offset="0.35" stop-color="${t.energy}" stop-opacity="0.8"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>`;
  defs += `<radialGradient id="${id}halo" cx="0" cy="2" r="74" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.glow}" stop-opacity="0.5"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>`;
  defs += `<linearGradient id="${id}shine" x1="-70" y1="-60" x2="70" y2="60" gradientUnits="userSpaceOnUse"><stop offset="0.35" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.85"/><stop offset="0.65" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  const spark = (x: number, y: number, r: number, cls: string) => `<path class="spark ${cls}" d="M${x},${y - r} L${x + r * 0.35},${y} L${x},${y + r} L${x - r * 0.35},${y} Z" fill="${t.energy}"/>`;

  return `<svg viewBox="-90 -72 180 150" width="${size}" height="${Math.round(size * 150 / 180)}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible;filter:drop-shadow(0 6px 16px ${t.halo})">`
    + `<defs>${defs}</defs>`
    + `<ellipse cx="0" cy="2" rx="76" ry="56" fill="url(#${id}halo)"/>`
    + `<g class="arc">`
    + `<path d="M6,-16 Q40,-34 ${WING.tip[0] - 2},${WING.tip[1] + 4}" fill="none" stroke="${t.energy}" stroke-width="2.4" stroke-linecap="round" opacity="0.9" style="filter:drop-shadow(0 0 5px ${t.glow})"/>`
    + `<path d="M-6,-16 Q-40,-34 ${-(WING.tip[0] - 2)},${WING.tip[1] + 4}" fill="none" stroke="${t.energy}" stroke-width="2.4" stroke-linecap="round" opacity="0.9" style="filter:drop-shadow(0 0 5px ${t.glow})"/>`
    + `</g>`
    + `<path d="${wing(1)}" fill="url(#${id}wg)" stroke="${t.pDark}" stroke-width="0.7" stroke-linejoin="round"/>`
    + `<path d="${wing(-1)}" fill="url(#${id}wg)" stroke="${t.pDark}" stroke-width="0.7" stroke-linejoin="round"/>`
    + plates
    + `<path d="${innerSpike(1)}" fill="url(#${id}sp)" stroke="${t.spDark}" stroke-width="0.6" stroke-linejoin="round"/>`
    + `<path d="${innerSpike(-1)}" fill="url(#${id}sp)" stroke="${t.spDark}" stroke-width="0.6" stroke-linejoin="round"/>`
    + `<path d="M0,-60 L8,-8 L4,42 L0,52 L-4,42 L-8,-8 Z" fill="url(#${id}sp)" stroke="${t.spDark}" stroke-width="0.7" stroke-linejoin="round"/>`
    + `<path d="M0,-60 L8,-8 L0,42 Z" fill="${t.spLight}" opacity="0.30"/>`
    + `<circle class="core" cx="0" cy="8" r="30" fill="url(#${id}core)"/>`
    + `<path d="M0,-14 L11,8 L0,30 L-11,8 Z" fill="url(#${id}gm)" stroke="${t.gemD}" stroke-width="0.8" stroke-linejoin="round"/>`
    + `<path d="M0,-14 L11,8 L0,11 L-11,8 Z" fill="${t.gemL}" opacity="0.6"/>`
    + `<path d="M0,11 L11,8 L0,30 Z" fill="${t.gemD}" opacity="0.35"/>`
    + `<path d="M-3,-3 L0,-9 L3,-3 L0,4 Z" fill="#fff" opacity="0.85"/>`
    + spark(WING.tip[0] - 4, WING.tip[1] + 2, 4, "a")
    + spark(-(WING.tip[0] - 4), WING.tip[1] + 2, 4, "b")
    + spark(0, -58, 3.5, "c")
    + spark(34, -2, 2.6, "b")
    + spark(-34, -2, 2.6, "a")
    + `<path class="shine" d="M0,-60 L8,-8 L4,42 L0,52 L-4,42 L-8,-8 Z M${TOP[3]} L${P} L${-TOP[3][0]},${TOP[3][1]} Z" fill="url(#${id}shine)" opacity="0"/>`
    + `</svg>`;
}

const KEY_BY_RANK: Record<number, TierKey> = { 1: "gold", 2: "silver", 3: "bronze" };

export default function RankEmblem({ rank, size = 48 }: { rank: number; size?: number }) {
  const key = KEY_BY_RANK[rank] ?? "bronze";
  const html = emblem(key, `re${rank}-`, size);
  return <span className="rank-emb" aria-hidden dangerouslySetInnerHTML={{ __html: html }} />;
}
