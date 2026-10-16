// Text measurement without a font engine. Widths are estimates; renderers pin
// each string with `textLength`, so a small error never overflows the shape.

export function escapeXml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);
}

// Verdana advance widths at 11px (the classic shields.io look).
function verdanaChar(c) {
  if (c === " ") return 3.9;
  if ("ijl.,:;'|!".includes(c)) return 3.4;
  if ("ftrI()[]{}".includes(c)) return 4.6;
  if ("mwMW".includes(c)) return 10.5;
  if (/[0-9]/.test(c)) return 7;
  if (/[A-Z]/.test(c)) return 7.6;
  if (/[a-z]/.test(c)) return 6.6;
  return 7.5;
}

export function verdanaWidth(text, fontSize = 11, letterSpacing = 0) {
  let w = 0;
  for (const c of text) w += verdanaChar(c);
  return w * (fontSize / 11) + letterSpacing * [...text].length;
}

// System UI sans (San Francisco, Segoe UI, Helvetica, Arial) widths in em.
function sansChar(c) {
  if (c === " ") return 0.28;
  if ("ijlI.,:;'|!".includes(c)) return 0.25;
  if ("ftr()[]{}-".includes(c)) return 0.34;
  if ("mM".includes(c)) return 0.86;
  if ("wW".includes(c)) return 0.8;
  if (/[0-9]/.test(c)) return 0.58;
  if (/[A-Z]/.test(c)) return 0.69;
  if (/[a-z]/.test(c)) return 0.55;
  return 0.62;
}

export function sansWidth(text, fontSize, { bold = false, letterSpacing = 0 } = {}) {
  let em = 0;
  for (const c of text) em += sansChar(c);
  return em * fontSize * (bold ? 1.06 : 1) + letterSpacing * [...text].length;
}

export const SANS_STACK = `-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif`;
