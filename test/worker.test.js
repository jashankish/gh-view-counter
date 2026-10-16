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
  const res = await get(e, "/api/views?user=octocat");
  assert.deepEqual(await res.json(), { id: "octocat", views: 50 });
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

test("label and colours cannot inject markup", () => {
  const svg = renderBadge({ label: `"><script>alert(1)</script>`, message: "1", color: `red" onload="x`, labelColor: "zzz" });
  assert.doesNotMatch(svg, /<script/);
  assert.doesNotMatch(svg, /onload/);
  assert.match(svg, /fill="#007ec6"/); // invalid colour falls back to default
  assert.match(svg, /fill="#555"/);
});

test("badge styles render with expected heights", () => {
  assert.match(renderBadge({ label: "views", message: "42" }), /height="20"/);
  assert.match(renderBadge({ label: "views", message: "42", style: "flat-square" }), /rx="0"/);
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
