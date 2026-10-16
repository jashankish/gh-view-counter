// A compact stats card: label, large total, today's views, and a 30-day trend
// line. Uses GitHub's light/dark palettes and, with theme=auto, follows the
// viewer's colour scheme via a media query inside the SVG.
import { escapeXml, sansWidth, SANS_STACK } from "../text.js";
import { eyeIcon, REDUCED_MOTION } from "./icon.js";
import { accentStops } from "./modern.js";

const THEMES = {
  light: { bg: "#ffffff", border: "#d0d7de", fg: "#1f2328", muted: "#59636e", grid: "#d8dee4" },
  dark: { bg: "#0d1117", border: "#30363d", fg: "#e6edf3", muted: "#9198a1", grid: "#30363d" },
};

const H = 104;
const PAD = 20;
const NUMBER_SIZE = 30;
const SPARK_W = 128;
const SPARK_TOP = 26;
const SPARK_H = 46;

function themeCss(t) {
  return `.bg{fill:${t.bg};stroke:${t.border}}.fg{fill:${t.fg}}.mu{fill:${t.muted}}.gr{stroke:${t.grid}}.dt{stroke:${t.bg}}`;
}

/**
 * Monotone cubic interpolation (harmonic-mean tangents, Fritsch–Butland):
 * a smooth curve that never overshoots the data, so the line can't dip below zero.
 */
export function smoothPath(pts) {
  const n = pts.length;
  if (n === 1) return `M${pts[0][0]} ${pts[0][1]}`;
  const slopes = [];
  for (let i = 0; i < n - 1; i++) slopes.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const t = pts.map((_, i) => {
    if (i === 0) return slopes[0];
    if (i === n - 1) return slopes[n - 2];
    const a = slopes[i - 1];
    const b = slopes[i];
    return a * b <= 0 ? 0 : (2 * a * b) / (a + b);
  });
  const f = (v) => Math.round(v * 100) / 100;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const dx = (x1 - x0) / 3;
    d += `C${f(x0 + dx)} ${f(y0 + t[i] * dx)} ${f(x1 - dx)} ${f(y1 - t[i + 1] * dx)} ${f(x1)} ${f(y1)}`;
  }
  return d;
}

export function renderCard({ label, message, color, theme = "auto", icon = true, animate = true, history = [], today = 0 }) {
  const [start, end] = accentStops(color);
  const upperLabel = label.toUpperCase();

  const numberW = Math.round(sansWidth(message, NUMBER_SIZE, { bold: true }));
  const sparkX = Math.max(184, PAD + numberW + 28);
  const W = sparkX + SPARK_W + PAD;

  // Trend line geometry. Leave headroom so the peak doesn't touch the top.
  const series = history.length ? history : [0];
  const max = Math.max(...series, 1) * 1.15;
  const step = series.length > 1 ? SPARK_W / (series.length - 1) : 0;
  const base = SPARK_TOP + SPARK_H;
  const pts = series.map((v, i) => [sparkX + i * step, base - (v / max) * SPARK_H]);
  const line = smoothPath(pts);
  const area = `${line}L${sparkX + SPARK_W} ${base}L${sparkX} ${base}Z`;
  const [lx, ly] = pts[pts.length - 1];

  const todayText = `+${today.toLocaleString("en-US")} today`;
  const title = escapeXml(`${label}: ${message} (${todayText})`);
  const labelX = PAD + (icon ? 20 : 0);
  const labelW = Math.round(sansWidth(upperLabel, 11, { bold: true, letterSpacing: 1 }));

  const palette =
    theme === "light" || theme === "dark"
      ? themeCss(THEMES[theme])
      : `${themeCss(THEMES.light)}@media (prefers-color-scheme:dark){${themeCss(THEMES.dark)}}`;

  // Motion is purely additive: the resting frame is the finished design. Browsers
  // may stop repainting animated SVGs inside <img>, so nothing may start hidden.
  const motion = animate
    ? `.pl{transform-box:fill-box;transform-origin:center;opacity:0;animation:pulse 2.4s .4s ease-out infinite}` +
      `@keyframes pulse{from{opacity:.45;transform:scale(1)}to{opacity:0;transform:scale(3)}}` +
      REDUCED_MOTION
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    `<style>${palette}${motion}</style>`,
    `<defs>`,
    `<linearGradient id="st" x2="1"><stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>`,
    `<linearGradient id="fl" x2="0" y2="1"><stop offset="0" stop-color="${end}" stop-opacity=".32"/><stop offset="1" stop-color="${start}" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="tx" x2="1"><stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>`,
    `</defs>`,
    `<rect class="bg" x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="12"/>`,
    // Header row
    icon ? eyeIcon(PAD, 19, start) : "",
    `<g font-family="${SANS_STACK}" text-rendering="geometricPrecision">`,
    `<text class="mu" x="${labelX}" y="30.5" font-size="11" font-weight="600" letter-spacing="1" textLength="${labelW}">${escapeXml(upperLabel)}</text>`,
    // Total
    `<text class="fg" x="${PAD}" y="70" font-size="${NUMBER_SIZE}" font-weight="700" letter-spacing="-.5" style="font-variant-numeric:tabular-nums" textLength="${numberW}">${escapeXml(message)}</text>`,
    // Today
    `<path d="M${PAD} 89.5l3.5-5 3.5 5z" fill="url(#tx)"/>`,
    `<text x="${PAD + 11}" y="90" font-size="11.5" font-weight="600" fill="url(#tx)">${escapeXml(todayText)}</text>`,
    `<text class="mu" x="${sparkX + SPARK_W}" y="90" font-size="10.5" text-anchor="end">Last ${series.length} days</text>`,
    `</g>`,
    // Trend
    `<line class="gr" x1="${sparkX}" y1="${base + 0.5}" x2="${sparkX + SPARK_W}" y2="${base + 0.5}" stroke-dasharray="2 3"/>`,
    `<path d="${area}" fill="url(#fl)"/>`,
    `<path class="ln" d="${line}" fill="none" stroke="url(#st)" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>`,
    animate ? `<circle class="pl" cx="${lx}" cy="${ly}" r="3.5" fill="${end}"/>` : "",
    `<circle cx="${lx}" cy="${ly}" r="3.5" fill="${end}" stroke-width="1.5" class="dt"/>`,
    `</svg>`,
  ].join("");
}
