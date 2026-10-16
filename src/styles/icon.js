// A simple eye glyph on a 14x14 grid, drawn as an outline with a solid pupil.
export function eyeIcon(x, y, color, size = 14) {
  const s = size / 14;
  return (
    `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M1 7c1.6-3 3.6-4.5 6-4.5s4.4 1.5 6 4.5c-1.6 3-3.6 4.5-6 4.5S2.6 10 1 7z"/>` +
    `<circle cx="7" cy="7" r="2.1" fill="${color}" stroke="none"/>` +
    `</g>`
  );
}

export const REDUCED_MOTION = `@media (prefers-reduced-motion:reduce){*{animation:none!important}}`;
