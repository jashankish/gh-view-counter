// The default style: a pill with an eye icon on a dark tab, and the count on a
// rounded gradient segment that overlaps it. A soft top highlight and hairline
// inner border give it depth; on load a light sweep crosses the gradient once.
// Motion is purely additive: the resting frame is the finished design, because
// browsers may stop repainting animated SVGs inside <img>.
import { resolveColor, shiftHue, isLight, mix } from "../color.js";
import { escapeXml, sansWidth, SANS_STACK } from "../text.js";
import { eyeIcon, REDUCED_MOTION } from "./icon.js";

const H = 28;
const R = H / 2;
const PAD = 11;
const ICON = 14;
const GAP = 6;
const OVERLAP = 6;
const LABEL_SIZE = 12;
const VALUE_SIZE = 12.5;

export const DEFAULT_ACCENT = "#6366f1";
const DEFAULT_ACCENT_END = "#a855f7";

/** Gradient stops for an accent colour. The default is indigo → purple. */
export function accentStops(color) {
  const start = resolveColor(color, DEFAULT_ACCENT);
  const end = start === DEFAULT_ACCENT ? DEFAULT_ACCENT_END : shiftHue(start, 32, 0.03);
  return [start, end];
}

export function renderModern({ label, message, color, labelColor, icon = true, animate = true }) {
  const left = resolveColor(labelColor, "#1f2328");
  const [start, end] = accentStops(color);
  const leftLight = isLight(left);
  const valueLight = isLight(mix(start, end, 0.5));

  const labelW = label ? Math.round(sansWidth(label, LABEL_SIZE, { bold: true })) : 0;
  const content = (icon ? ICON : 0) + (icon && label ? GAP : 0) + labelW;
  const leftW = content ? content + PAD * 2 + OVERLAP : 0;
  const valueTextW = Math.round(sansWidth(message, VALUE_SIZE, { bold: true }));
  const segW = valueTextW + PAD * 2 + 2;
  const segX = leftW ? leftW - OVERLAP : 0;
  const W = segX + segW;

  const title = escapeXml(label ? `${label}: ${message}` : message);
  const iconColor = leftLight ? start : mix(start, "#ffffff", 0.45);
  const labelFill = leftLight ? "#1f2328" : "#ffffff";
  const valueFill = valueLight ? "#1f2328" : "#ffffff";
  const valueX = segX + segW / 2;

  const style = animate
    ? `<style>` +
      `.sw{opacity:0;animation:sweep 1.3s .35s cubic-bezier(.4,0,.2,1)}` +
      `@keyframes sweep{from{opacity:1;transform:translateX(${segX - 40}px)}to{opacity:1;transform:translateX(${W + 10}px)}}` +
      REDUCED_MOTION +
      `</style>`
    : "";

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">`,
    `<title>${title}</title>`,
    style,
    `<defs>`,
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${start}"/><stop offset="1" stop-color="${end}"/></linearGradient>`,
    `<linearGradient id="hl" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="sh" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<clipPath id="c"><rect width="${W}" height="${H}" rx="${R}"/></clipPath>`,
    `<clipPath id="cs"><rect x="${segX}" width="${segW}" height="${H}" rx="${R}"/></clipPath>`,
    `</defs>`,
    `<g clip-path="url(#c)">`,
    leftW ? `<rect width="${W}" height="${H}" fill="${left}"/>` : "",
    // A soft shadow where the value segment overlaps the label tab.
    leftW ? `<rect x="${segX - 2}" width="${segW + 2}" height="${H}" rx="${R}" fill="#000" fill-opacity=".22"/>` : "",
    `<rect x="${segX}" width="${segW}" height="${H}" rx="${R}" fill="url(#g)"/>`,
    animate ? `<g clip-path="url(#cs)"><rect class="sw" width="34" height="${H}" fill="url(#sh)" transform="skewX(-20)"/></g>` : "",
    `<rect width="${W}" height="${H}" fill="url(#hl)"/>`,
    `</g>`,
    `<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="${R - 0.5}" fill="none" stroke="#fff" stroke-opacity=".14"/>`,
    icon && leftW ? eyeIcon(PAD, (H - ICON) / 2, iconColor) : "",
    `<g font-family="${SANS_STACK}" text-rendering="geometricPrecision">`,
    label
      ? `<text x="${PAD + (icon ? ICON + GAP : 0)}" y="18" fill="${labelFill}" fill-opacity=".92" font-size="${LABEL_SIZE}" font-weight="600" textLength="${labelW}">${escapeXml(label)}</text>`
      : "",
    `<g text-anchor="middle" font-size="${VALUE_SIZE}" font-weight="700" style="font-variant-numeric:tabular-nums">`,
    valueLight ? "" : `<text x="${valueX}" y="19" fill="#000" fill-opacity=".18" textLength="${valueTextW}">${escapeXml(message)}</text>`,
    `<text x="${valueX}" y="18" fill="${valueFill}" textLength="${valueTextW}">${escapeXml(message)}</text>`,
    `</g>`,
    `</g>`,
    `</svg>`,
  ].join("");
}
