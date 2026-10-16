import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRequest } from "../src/index.js";
import { renderBadge, formatCount, resolveColor, escapeXml } from "../src/badge.js";
import { parseTarget } from "../src/params.js";
import { createFakeD1 } from "./fake-d1.js";

const env = (overrides = {}) => ({ DB: createFakeD1(), ALLOWED_USERS: "", COUNT_ONLY_CAMO: "false", ...overrides });
const get = (e, path, init) => handleRequest(new Request(`https://counter.test${path}`, init), e);
const countIn = (svg) => svg.match(/<title>[^:]*: ([^<]+)<\/title>/)[1];

test("increments atomically and returns an uncacheable SVG", async () => {
  const e = env();
  for (let i = 1; i <= 3; i++) {
    const res = await get(e, "/?user=jashankish");
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "image/svg+xml; charset=utf-8");
    assert.match(res.headers.get("Cache-Control"), /no-store/);
    assert.match(res.headers.get("Cache-Control"), /max-age=0/);
    assert.equal(countIn(await res.text()), String(i));
  }
});

test("concurrent views are never lost", async () => {
  const e = env();
  await Promise.all(Array.from({ length: 50 }, () => get(e, "/?user=octocat")));
  const body = await (await get(e, "/api/views?user=octocat")).json();
  assert.equal(body.id, "octocat");
  assert.equal(body.views, 50);
  assert.equal(body.today, 50, "daily bucket is incremented in the same batch");
});

test("usernames are case-insensitive and repos get separate counters", async () => {
  const e = env();
  await get(e, "/?user=JashanKish");
  await get(e, "/?user=jashankish");
  await get(e, "/?user=jashankish&repo=My.Repo");
  assert.equal((await (await get(e, "/api/views?user=jashankish")).json()).views, 2);
  assert.equal((await (await get(e, "/api/views?user=jashankish&repo=my.repo")).json()).views, 1);
});

test("preview, HEAD and /api/views do not increment", async () => {
  const e = env();
  await get(e, "/?user=a");
  await get(e, "/?user=a&preview=true");
  await get(e, "/?user=a", { method: "HEAD" });
  await get(e, "/api/views?user=a");
  assert.equal((await (await get(e, "/api/views?user=a")).json()).views, 1);
});

test("COUNT_ONLY_CAMO only counts GitHub's proxy", async () => {
  const e = env({ COUNT_ONLY_CAMO: "true" });
  await get(e, "/?user=a", { headers: { "User-Agent": "Mozilla/5.0" } });
  await get(e, "/?user=a", { headers: { "User-Agent": "github-camo (876de43e)" } });
  assert.equal((await (await get(e, "/api/views?user=a")).json()).views, 1);
});

test("allowlist blocks other users without touching the DB", async () => {
  const e = env({ ALLOWED_USERS: "jashankish, other" });
  const res = await get(e, "/?user=stranger");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /user not allowed/);
  assert.equal((await get(e, "/api/views?user=stranger")).status, 403);
  assert.equal(e.DB.raw.prepare("SELECT COUNT(*) AS n FROM views").get().n, 0);
  assert.match(await (await get(e, "/?user=Other")).text(), /: 1</);
});

test("invalid input renders an error badge instead of breaking the image", async () => {
  const e = env();
  for (const q of ["user=-bad", "user=a--b", "user=<script>", "user=a&repo=..", "user=" + "x".repeat(40)]) {
    const body = await (await get(e, `/?${q}`)).text();
    assert.match(body, /invalid (user|repo)/, q);
  }
});

test("database failure degrades to an 'unavailable' badge", async () => {
  const broken = { prepare: () => { throw new Error("D1 down"); } };
  const orig = console.error;
  console.error = () => {};
  try {
    const res = await get({ DB: broken }, "/?user=a");
    assert.equal(res.status, 200);
    assert.match(await res.text(), /unavailable/);
  } finally {
    console.error = orig;
  }
});

test("base offset and abbreviation affect display only", async () => {
  const e = env();
  const body = await (await get(e, "/?user=a&base=1499&abbreviated=true")).text();
  assert.equal(countIn(body), "1.5k");
  assert.equal((await (await get(e, "/api/views?user=a")).json()).views, 1);
});

test("routing: usage page, health, 404, 405", async () => {
  const e = env();
  assert.match(await (await get(e, "/")).text(), /GitHub view counter/);
  assert.deepEqual(await (await get(e, "/health")).json(), { ok: true });
  assert.equal((await get(e, "/nope")).status, 404);
  assert.equal((await get(e, "/?user=a", { method: "POST" })).status, 405);
});

test("label and colours cannot inject markup in any style", () => {
  for (const style of ["modern", "card", "flat", "flat-square", "for-the-badge"]) {
    const svg = renderBadge({
      style,
      label: `"><script>alert(1)</script>`,
      message: "1",
      color: `red" onload="x`,
      labelColor: "zzz",
      history: [1, 2, 3],
      today: 3,
    });
    assert.doesNotMatch(svg, /<script/i, style);
    assert.doesNotMatch(svg, /onload/, style);
  }
  // invalid colours fall back to each style's defaults
  const flat = renderBadge({ style: "flat", label: "a", message: "1", color: "url(#x)", labelColor: "zzz" });
  assert.match(flat, /fill="#007ec6"/);
  assert.match(flat, /fill="#555"/);
  assert.match(renderBadge({ label: "a", message: "1", color: "url(#x)" }), /stop-color="#6366f1"/);
});

test("default style is the modern pill", async () => {
  const svg = await (await get(env(), "/?user=a")).text();
  assert.match(svg, /height="28"/);
  assert.match(svg, /rx="14"/);
  assert.match(svg, /linearGradient id="g"/);
  assert.match(svg, /<path d="M1 7c/, "eye icon");
  assert.match(svg, /@keyframes sweep/);
  assert.match(svg, /prefers-reduced-motion/);
});

test("animations never hide content at rest", () => {
  // Browsers may freeze animated SVGs in <img> on the first frame, so the only
  // element allowed to start transparent is a decorative one (sweep / pulse).
  for (const style of ["modern", "card"]) {
    const svg = renderBadge({ style, label: "v", message: "1", history: [1, 2], today: 2 });
    const hidden = [...svg.matchAll(/\.([\w-]+)\{[^}]*opacity:0[;}]/g)].map((m) => m[1]);
    assert.deepEqual(hidden.filter((c) => !["sw", "pl"].includes(c)), [], style);
    assert.doesNotMatch(svg, /from\{opacity:0/, style);
  }
});

test("modern options: icon, animate, colour gradient", () => {
  const plain = renderBadge({ label: "views", message: "42", icon: false, animate: false });
  assert.doesNotMatch(plain, /M1 7c/);
  assert.doesNotMatch(plain, /<style>/);
  const teal = renderBadge({ label: "views", message: "42", color: "teal" });
  assert.match(teal, /stop-color="#14b8a6"/);
  assert.equal((teal.match(/stop-color="#[0-9a-f]{6}"/g) ?? []).length >= 2, true);
  const noLabel = renderBadge({ label: "", message: "42", icon: false });
  assert.match(noLabel, /<rect x="0" width/);
});

test("card shows total, today and a 30-day trend", async () => {
  const e = env();
  for (let i = 0; i < 3; i++) await get(e, "/?user=a");
  const svg = await (await get(e, "/?user=a&style=card")).text();
  assert.match(svg, /height="104"/);
  assert.match(svg, />4</, "total");
  assert.match(svg, /\+4 today/);
  assert.match(svg, /Last 30 days/);
  assert.match(svg, /<path class="ln" d="M[\d.]+ [\d.]+(C[\d. ]+){29}"/, "29 curve segments for 30 points");
  assert.match(svg, /prefers-color-scheme:dark/);
  const dark = await (await get(e, "/?user=a&style=card&theme=dark&preview=true")).text();
  assert.doesNotMatch(dark, /prefers-color-scheme/);
  assert.match(dark, /fill:#0d1117/);
});

test("card errors fall back to the pill", async () => {
  const svg = await (await get(env({ ALLOWED_USERS: "x" }), "/?user=a&style=card")).text();
  assert.match(svg, /user not allowed/);
  assert.match(svg, /height="28"/);
});

test("history is zero-filled and ordered oldest first", async () => {
  const e = env();
  const day = new Date().toISOString().slice(0, 10);
  const prev = new Date(Date.now() - 2 * 86400e3).toISOString().slice(0, 10);
  e.DB.raw.exec(`INSERT INTO daily_views (id, day, count) VALUES ('a', '${prev}', 7), ('a', '${day}', 2)`);
  const { history } = await (await get(e, "/api/views?user=a")).json();
  assert.equal(history.length, 30);
  assert.deepEqual(history.slice(-3), [7, 0, 2]);
});

test("smoothed trend never overshoots the data", () => {
  const svg = renderBadge({ style: "card", label: "v", message: "1", history: [0, 10, 0, 0, 50, 0], today: 0 });
  const d = svg.match(/class="ln" d="([^"]+)"/)[1];
  const ys = [...d.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((m) => +m[2]);
  // the plot area spans y=26..72
  assert.ok(Math.min(...ys) >= 26 && Math.max(...ys) <= 72, `y range ${Math.min(...ys)}..${Math.max(...ys)}`);
});

test("classic styles still render", () => {
  assert.match(renderBadge({ style: "flat", label: "views", message: "42" }), /height="20"/);
  assert.match(renderBadge({ style: "flat-square", label: "views", message: "42" }), /rx="0"/);
  const ftb = renderBadge({ label: "views", message: "42", style: "for-the-badge" });
  assert.match(ftb, /height="28"/);
  assert.match(ftb, />VIEWS</);
});

test("helpers", () => {
  assert.equal(formatCount(1234), "1,234");
  assert.equal(formatCount(999, true), "999");
  assert.equal(formatCount(1000, true), "1k");
  assert.equal(formatCount(25_400, true), "25k");
  assert.equal(formatCount(3_200_000, true), "3.2M");
  assert.equal(resolveColor("#ABC", "x"), "#abc");
  assert.equal(resolveColor("ff8800", "x"), "#ff8800");
  assert.equal(resolveColor("brightgreen", "x"), "#4c1");
  assert.equal(resolveColor("url(#evil)", "x"), "x");
  assert.equal(escapeXml(`<a&"'>`), "&lt;a&amp;&quot;&apos;&gt;");
  assert.deepEqual(parseTarget(new URLSearchParams("user=Octo-Cat")), { user: "octo-cat", id: "octo-cat" });
});
