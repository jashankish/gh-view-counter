// Shields.io-compatible badge renderer. No dependencies, no fonts to load:
// widths are estimated from Verdana metrics and pinned with `textLength`.

const NAMED_COLORS = {
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
};

export const DEFAULT_COLOR = "#007ec6";
export const DEFAULT_LABEL_COLOR = "#555";
export const ERROR_COLOR = "#e05d44";

/** Accepts a named colour or 3/6-digit hex (with or without '#'). Anything else falls back. */
export function resolveColor(input, fallback) {
  if (!input) return fallback;
  const v = String(input).trim().toLowerCase().replace(/^#/, "");
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  if (/^(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(v)) return `#${v}`;
  return fallback;
}

export function formatCount(n, abbreviated = false) {
  if (!abbreviated || n < 1000) return n.toLocaleString("en-US");
  const units = ["k", "M", "B", "T"];
  let value = n;
  let unit = -1;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = value < 10 ? 1 : 0;
  return `${Number(value.toFixed(digits))}${units[unit]}`;
}

export function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

// Approximate advance widths of Verdana at 11px.
function charWidth(c) {
  if (c === " ") return 3.9;
  if ("ijl.,:;'|!".includes(c)) return 3.4;
  if ("ftrI()[]{}".includes(c)) return 4.6;
  if ("mwMW".includes(c)) return 10.5;
  if (/[0-9]/.test(c)) return 7;
  if (/[A-Z]/.test(c)) return 7.6;
  if (/[a-z]/.test(c)) return 6.6;
  return 7.5;
}

export function textWidth(text, fontSize = 11, letterSpacing = 0) {
  let w = 0;
  for (const c of text) w += charWidth(c);
  return w * (fontSize / 11) + letterSpacing * [...text].length;
}

// Pick dark text on light backgrounds so custom colours stay readable.
function textColorsFor(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.65 ? { fill: "#333", shadow: "#ccc" } : { fill: "#fff", shadow: "#010101" };
}

const STYLE_METRICS = {
  flat: { height: 20, fontSize: 11, pad: 6, radius: 3, gradient: true, baseline: 14, upper: false, spacing: 0, weight: "normal" },
  "flat-square": { height: 20, fontSize: 11, pad: 6, radius: 0, gradient: false, baseline: 14, upper: false, spacing: 0, weight: "normal" },
  "for-the-badge": { height: 28, fontSize: 10, pad: 12, radius: 0, gradient: false, baseline: 18, upper: true, spacing: 1.2, weight: "bold" },
};

/**
 * @param {{label: string, message: string, color?: string, labelColor?: string, style?: string}} opts
 * @returns {string} SVG markup
 */
export function renderBadge({ label, message, color, labelColor, style = "flat" }) {
  const m = STYLE_METRICS[style] ?? STYLE_METRICS.flat;
  const right = resolveColor(color, DEFAULT_COLOR);
  const left = resolveColor(labelColor, DEFAULT_LABEL_COLOR);
  const labelText = m.upper ? label.toUpperCase() : label;
  const messageText = m.upper ? message.toUpperCase() : message;

  const labelTextW = Math.round(textWidth(labelText, m.fontSize, m.spacing));
  const msgTextW = Math.round(textWidth(messageText, m.fontSize, m.spacing));
  const hasLabel = labelText.length > 0;
  const lw = hasLabel ? labelTextW + m.pad * 2 : 0;
  const mw = msgTextW + m.pad * 2;
  const w = lw + mw;
  const h = m.height;

  const title = escapeXml(hasLabel ? `${label}: ${message}` : message);
  const font = `font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="${m.fontSize}" font-weight="${m.weight}"${m.spacing ? ` letter-spacing="${m.spacing}"` : ""}`;

  const text = (content, cx, tw, bg) => {
    const c = textColorsFor(bg);
    const esc = escapeXml(content);
    const shadow = m.gradient
      ? `<text x="${cx}" y="${m.baseline + 1}" fill="${c.shadow}" fill-opacity=".3" textLength="${tw}">${esc}</text>`
      : "";
    return `${shadow}<text x="${cx}" y="${m.baseline}" fill="${c.fill}" textLength="${tw}">${esc}</text>`;
  };

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    m.gradient
      ? `<linearGradient id="s" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>`
      : "",
    `<clipPath id="r"><rect width="${w}" height="${h}" rx="${m.radius}" fill="#fff"/></clipPath>`,
    `<g clip-path="url(#r)">`,
    hasLabel ? `<rect width="${lw}" height="${h}" fill="${left}"/>` : "",
    `<rect x="${lw}" width="${mw}" height="${h}" fill="${right}"/>`,
    m.gradient ? `<rect width="${w}" height="${h}" fill="url(#s)"/>` : "",
    `</g>`,
    `<g text-anchor="middle" text-rendering="geometricPrecision" ${font}>`,
    hasLabel ? text(labelText, lw / 2, labelTextW, left) : "",
    text(messageText, lw + mw / 2, msgTextW, right),
    `</g>`,
    `</svg>`,
  ].join("");
}
