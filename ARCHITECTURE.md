# Architecture

## Request flow

```
 Visitor's browser                GitHub                        Cloudflare edge (same PoP)
 ─────────────────   ─────────────────────────────   ──────────────────────────────────────────
 opens profile  ───▶ github.com renders README
                     <img src="camo.githubusercontent.com/…">
 fetches image  ───▶ camo proxy ───── GET /?user=x ───▶ Worker (src/index.js)
                                                         1. validate user/repo, allowlist
                                                         2. D1 batch (one transaction):
                                                              total  += 1 RETURNING count
                                                              today  += 1
                                                         3. card style only: read 30-day history
                                                         4. render SVG (src/badge.js → src/styles/)
                     camo ◀── 200 image/svg+xml ─────────  5. Cache-Control: no-store, max-age=0
 badge shows N  ◀─── (not cached, so the next visit fetches again)
```

## Why this stack

| Decision | Reason |
| --- | --- |
| **Cloudflare Workers** for compute | V8 isolates have no cold start to speak of. The free tier allows 100k requests a day, and the Worker runs in the data center nearest to camo. |
| **D1** for storage, not KV | KV's free tier allows only **1,000 writes a day**, so a counter on KV freezes after 1,000 views. D1 allows **100,000 rows written a day** and 5M rows read. |
| Atomic upserts, batched | Each increment is a single `INSERT … ON CONFLICT DO UPDATE SET count = count + 1` statement. Concurrent views therefore can't overwrite each other (tests run 50 views in parallel). The total and daily statements are sent as one `batch()`: one round trip and one transaction. |
| `WITHOUT ROWID` tables | Rows are stored in the primary-key b-tree, so each table costs **1 row written** per view, with no separate index entry. |
| History read only when needed | Only the `card` style shows the trend line, so the other styles skip the 30-row history read. |
| SVG rendered by hand, no libraries | The bundle stays tiny (about 8 KiB gzipped) and there are no fonts to fetch. Text widths are estimated from font metrics and fixed with `textLength`. |
| Motion is additive only | Browsers may stop repainting animated SVGs inside `<img>`, so a badge can freeze on its first frame. Nothing important starts hidden; animations only add decoration (a light sweep, a pulse) to an already finished design. |
| Errors returned as **200** SVGs | camo shows a broken image for responses outside 2xx. A red "invalid user" or "unavailable" badge is easier to diagnose. |
| A username allowlist | A public endpoint on a free tier invites others to use up your quota. Each deployment sets its own `ALLOWED_USERS`. |
| No deployment-specific values in the repo | `wrangler.toml` ships with a placeholder database ID and an empty allowlist. Each deployment supplies its own, by editing the file locally or through GitHub Actions secrets and variables, so the repository can be public without exposing anyone's Cloudflare details. |

## Free-tier capacity

| Resource | Free limit | Cost per view | Max views/day |
| --- | --- | --- | --- |
| Workers requests | 100,000 / day | 1 | 100,000 |
| D1 rows written | 100,000 / day | 2 (total and today) | **50,000** ← binding limit |
| D1 rows read | 5,000,000 / day | 1, or up to 31 for `card` | ~160,000 or more |
| D1 storage | 5 GB | ~50 B per counter, plus ~40 B per counter per day | effectively unlimited |

Workers also allow 10 ms of CPU per request on the free plan. This Worker uses well under 1 ms, because time spent waiting on D1 does not count as CPU time.

If traffic goes over the daily limit, Cloudflare returns an error page until the quota resets at 00:00 UTC. The badge breaks for the rest of that day but no data is lost. The Workers Paid plan costs $5 a month and covers 10M requests.

## Alternatives considered

| Stack | Ceiling on free tier | Why it was not chosen |
| --- | --- | --- |
| Workers + KV | ~1,000 views/day | Too few writes. KV is also eventually consistent, so concurrent increments would be lost. |
| Workers + Durable Objects | 100k/day | A strongly consistent counter, but more moving parts than one SQL row. |
| Vercel Edge + Upstash Redis | ~16k views/day (500k commands/month) | Two vendors and two round trips across providers. The quota is monthly, so a traffic spike can use it up early. |
| AWS Lambda + DynamoDB | ~33k/day (1M requests/month) | Needs an API Gateway setup, has cold starts, and has a higher risk of unexpected bills. |

Free-tier figures come from the providers' documentation at the time of writing. Check the current pricing pages before relying on them.

## Files

```
src/index.js          routing, counting policy, HTTP headers
src/db.js             SQL: batched increment, total read, 30-day history
src/params.js         input validation (GitHub username/repo rules), badge options
src/badge.js          style dispatcher, error badges, number formatting
src/color.js          named palette, hex parsing, luminance, hue shifting for gradients
src/text.js           text-width estimation (Verdana, system sans), XML escaping
src/styles/modern.js  default pill style
src/styles/card.js    stats card with a 30-day trend line
src/styles/classic.js shields-compatible flat, flat-square, for-the-badge
src/styles/icon.js    eye glyph, reduced-motion rule
migrations/           D1 schema (views, daily_views)
scripts/              renders docs/examples/*.svg
test/                 node:test suite; fake-d1.js runs the real migrations on node:sqlite
```
