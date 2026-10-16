// Shields.io-compatible styles: flat, flat-square, for-the-badge.
import { resolveColor, isLight } from "../color.js";
import { escapeXml, verdanaWidth } from "../text.js";

const METRICS = {
  flat: { height: 20, fontSize: 11, pad: 6, radius: 3, gradient: true, baseline: 14, upper: false, spacing: 0, weight: "normal" },
  "flat-square": { height: 20, fontSize: 11, pad: 6, radius: 0, gradient: false, baseline: 14, upper: false, spacing: 0, weight: "normal" },
  "for-the-badge": { height: 28, fontSize: 10, pad: 12, radius: 0, gradient: false, baseline: 18, upper: true, spacing: 1.2, weight: "bold" },
};

export function renderClassic({ label, message, color, labelColor, style }) {
  const m = METRICS[style] ?? METRICS.flat;
  const right = resolveColor(color, "#007ec6");
  const left = resolveColor(labelColor, "#555");
  const labelText = m.upper ? label.toUpperCase() : label;
  const messageText = m.upper ? message.toUpperCase() : message;

  const labelTextW = Math.round(verdanaWidth(labelText, m.fontSize, m.spacing));
  const msgTextW = Math.round(verdanaWidth(messageText, m.fontSize, m.spacing));
  const hasLabel = labelText.length > 0;
  const lw = hasLabel ? labelTextW + m.pad * 2 : 0;
  const mw = msgTextW + m.pad * 2;
  const w = lw + mw;
  const h = m.height;

  const title = escapeXml(hasLabel ? `${label}: ${message}` : message);
  const font = `font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="${m.fontSize}" font-weight="${m.weight}"${m.spacing ? ` letter-spacing="${m.spacing}"` : ""}`;

  const text = (content, cx, tw, bg) => {
    const light = isLight(bg);
    const esc = escapeXml(content);
    const shadow = m.gradient
      ? `<text x="${cx}" y="${m.baseline + 1}" fill="${light ? "#ccc" : "#010101"}" fill-opacity=".3" textLength="${tw}">${esc}</text>`
      : "";
    return `${shadow}<text x="${cx}" y="${m.baseline}" fill="${light ? "#333" : "#fff"}" textLength="${tw}">${esc}</text>`;
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
