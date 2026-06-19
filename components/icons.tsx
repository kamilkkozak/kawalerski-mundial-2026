import React from "react";

// Zestaw ikon z designu (inline SVG, stroke=currentColor).
export const I: Record<string, React.ReactNode> = {
  grid: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  cal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>,
  flow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><path d="M4 6h6M4 18h6M10 6v12M10 12h5"/><circle cx="18" cy="12" r="2.5"/></svg>,
  cup: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3M9 14.5V18M9 21h6M15 14.5V18"/></svg>,
  trophy: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3M9 14.5V18M9 21h6M15 14.5V18"/></svg>,
  star: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><path d="m12 3 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8 6.8 19l1-5.8-4.2-4.1 5.8-.8L12 3Z"/></svg>,
  ball: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><circle cx="12" cy="12" r="9"/><path d="m12 7 4.7 3.4-1.8 5.5H9.1l-1.8-5.5L12 7Z"/><path d="m12 3 0 4M4.5 9.8 8 12.3M19.5 9.8 16 12.3M6.8 19l2.3-3M17.2 19l-2.3-3"/></svg>,
  cog: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V20a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.5"/></svg>,
  lock: <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/></svg>,
  grab: <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>,
  x: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="18" height="18"><path d="M6 6l12 12M18 6 6 18"/></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="14" height="14"><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  check: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="16" height="16"><path d="M5 13l4 4L19 7"/></svg>,
  menu: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20"><path d="M4 7h16M4 12h16M4 17h16"/></svg>,
  pin: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><path d="M12 21s7-6.3 7-11a7 7 0 0 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>,
  list: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.4"/><circle cx="4.5" cy="12" r="1.4"/><circle cx="4.5" cy="18" r="1.4"/></svg>,
  eye: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>,
  people: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="11" height="11"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 5.2a3 3 0 0 1 0 5.6M20.5 20a5.5 5.5 0 0 0-4-5.3"/></svg>,
  table: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="nav-ico"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9.5h18M3 14.5h18M9 9.5v10"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="13" height="13"><path d="M4 20V11M10 20V5M16 20v-6M21 20H3" strokeLinecap="round"/></svg>,
};

// Własny herb ligi (nie godło FIFA): heksagonalny badge + "26".
export function BrandCrest({ size = 46 }: { size?: number }) {
  const id = "bc" + size;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-label="Mundial 26">
      <defs>
        <linearGradient id={id + "g"} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="color-mix(in srgb, var(--accent) 80%, #fff)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <path d="M32 2.5 56 16v32L32 61.5 8 48V16L32 2.5Z" fill="color-mix(in srgb, var(--accent) 12%, transparent)" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M32 7 51.5 18v28L32 57 12.5 46V18L32 7Z" stroke="color-mix(in srgb, var(--accent) 35%, transparent)" strokeWidth="1" fill="none" />
      <g stroke="var(--accent)" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M25 15h14v5a7 7 0 0 1-14 0v-5Z" />
        <path d="M39 16.5h4.5v2.2a3.2 3.2 0 0 1-3.2 3.2M25 16.5h-4.5v2.2a3.2 3.2 0 0 0 3.2 3.2" />
        <path d="M32 27v3.4M28.5 33h7" />
      </g>
      <text x="32" y="45.5" textAnchor="middle" fontFamily="Anton, sans-serif" fontSize="20" letterSpacing="-0.5" fill={`url(#${id}g)`}>26</text>
    </svg>
  );
}
