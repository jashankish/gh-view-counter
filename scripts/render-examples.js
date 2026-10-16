// Renders the example badges shown in the README into docs/examples/.
// Usage: npm run examples
import { mkdirSync, writeFileSync } from "node:fs";
import { renderBadge } from "../src/badge.js";

const out = new URL("../docs/examples/", import.meta.url);
mkdirSync(out, { recursive: true });

// A plausible 30-day curve: a weekly rhythm with a spike when a project was shared.
const history = [
  14, 18, 22, 19, 12, 9, 16, 21, 25, 23, 17, 11, 15, 24, 31, 28, 19, 13, 18, 42, 87, 64, 39, 30, 26, 33, 29, 22, 27, 38,
];
const base = { label: "Profile views", message: "12,847" };

const examples = {
  "modern": { ...base },
  "modern-teal": { ...base, color: "teal" },
  "modern-rose": { ...base, color: "rose", label: "Visitors" },
  "modern-amber-light": { ...base, color: "amber", labelColor: "f6f8fa" },
  "modern-compact": { label: "", message: "12.8k", icon: true },
  "card": { ...base, style: "card", history, today: 38 },
  "card-light": { ...base, style: "card", theme: "light", history, today: 38 },
  "card-dark": { ...base, style: "card", theme: "dark", history, today: 38 },
  "card-emerald": { ...base, style: "card", color: "emerald", theme: "dark", history, today: 38 },
  "flat": { ...base, style: "flat" },
  "flat-square": { ...base, style: "flat-square", color: "brightgreen" },
  "for-the-badge": { ...base, style: "for-the-badge", color: "blueviolet" },
};

for (const [name, opts] of Object.entries(examples)) {
  writeFileSync(new URL(`${name}.svg`, out), renderBadge(opts) + "\n");
}
console.log(`wrote ${Object.keys(examples).length} examples to docs/examples/`);
