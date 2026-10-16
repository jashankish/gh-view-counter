const NAMED_COLORS = {
  // shields.io names, so existing badge URLs keep working
  brightgreen: "#4c1",
  green: "#97ca00",
  yellowgreen: "#a4a61d",
  yellow: "#dfb317",
  orange: "#fe7d37",
  red: "#e05d44",
  blue: "#007ec6",
  blueviolet: "#8a2be2",
  grey: "#555",
  gray: "#555",
  lightgrey: "#9f9f9f",
  lightgray: "#9f9f9f",
  success: "#4c1",
  important: "#fe7d37",
  critical: "#e05d44",
  informational: "#007ec6",
  inactive: "#9f9f9f",
  // a modern palette for the gradient styles
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  pink: "#ec4899",
  rose: "#f43f5e",
  amber: "#f59e0b",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  slate: "#64748b",
  black: "#1f2328",
};

/** Accepts a named colour or 3/6-digit hex (with or without '#'). Anything else falls back. */
export function resolveColor(input, fallback) {
  if (!input) return fallback;
  const v = String(input).trim().toLowerCase().replace(/^#/, "");
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  if (/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return `#${v}`;
  return fallback;
}

export function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function rgbToHex(rgb) {
  return `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

/** Perceived brightness, 0 (black) to 1 (white). */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isLight(hex) {
  return luminance(hex) > 0.65;
}

/** Linear blend of two colours; t=0 gives `a`, t=1 gives `b`. */
export function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

/** Rotate hue by `deg` and nudge lightness, for deriving a gradient's second stop. */
export function shiftHue(hex, deg, lightness = 0) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  h = (((h + deg) % 360) + 360) % 360;
  const nl = Math.min(1, Math.max(0, l + lightness));
  const c = (1 - Math.abs(2 * nl - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = nl - c / 2;
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbToHex([r1, g1, b1].map((v) => (v + m) * 255));
}
