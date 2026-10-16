import { renderClassic } from "./styles/classic.js";
import { renderModern } from "./styles/modern.js";
import { renderCard } from "./styles/card.js";

export { resolveColor } from "./color.js";
export { escapeXml } from "./text.js";

export const ERROR_COLOR = "#e5534b";

/**
 * Render a badge in the requested style.
 * @param {object} opts label, message, color, labelColor, style, theme, icon, animate,
 *                      and for `card`: history (number[]) and today (number)
 */
export function renderBadge(opts) {
  switch (opts.style) {
    case "card":
      return renderCard(opts);
    case "flat":
    case "flat-square":
    case "for-the-badge":
      return renderClassic(opts);
    default:
      return renderModern(opts);
  }
}

/** Error badges keep the requested family, but a card has no data, so it falls back to the pill. */
export function renderError(opts, message) {
  const style = opts.style === "card" ? "modern" : opts.style;
  return renderBadge({ ...opts, style, message, color: ERROR_COLOR });
}

export function formatCount(n, abbreviated = false) {
  if (!abbreviated || n < 1000) return n.toLocaleString("en-US");
  const units = ["k", "M", "B", "T"];
  let unit = 0;
  while (unit < units.length - 1 && n >= 1000 ** (unit + 2)) unit++;
  const scale = 1000 ** (unit + 1);
  // Round with integer division (not toFixed) so halves round up reliably:
  // one decimal below 10 (1.2k), whole numbers above (13k).
  let value = n < scale * 10 ? Math.round(n / (scale / 10)) / 10 : Math.round(n / scale);
  // 999,999 rounds to 1000k; carry it into the next unit instead (1M).
  if (value >= 1000 && unit < units.length - 1) {
    unit++;
    value = 1;
  }
  return `${value}${units[unit]}`;
}
