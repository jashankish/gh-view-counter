# Architecture

## Request flow

```
 Visitor's browser                GitHub                        Cloudflare edge (same PoP)
 ─────────────────   ─────────────────────────────   ──────────────────────────────────────────
 opens profile  ───▶ github.com renders README
                     <img src="camo.githubusercontent.com/…">
 fetches image  ───▶ camo proxy ───── GET /?user=x ───▶ Worker (src/index.js)
                                                         1. validate user/repo, allowlist
                                                         2. D1: INSERT … ON CONFLICT DO UPDATE
                                                               SET count = count + 1 RETURNING count
                                                         3. render SVG (src/badge.js)
                     camo ◀── 200 image/svg+xml ─────────  4. Cache-Control: no-store, max-age=0
 badge shows N  ◀─── (not cached, so the next visit fetches again)
```

## Why this stack

| Decision | Reason |
| --- | --- |
| **Cloudflare Workers** for compute | V8 isolates have no cold start to speak of. The free tier allows 100k requests a day, and the Worker runs in the data center nearest to camo. |
| **D1** for storage, not KV | KV's free tier allows only **1,000 writes a day**, so a counter on KV freezes after 1,000 views. D1 allows **100,000 rows written a day** and 5M rows read, which leaves the Worker's request limit as the only real cap. |
| One SQL statement per view | The upsert with `RETURNING` increments and reads in one atomic step, so concurrent views cannot overwrite each other (tests run 50 views in parallel). It also costs one round trip instead of a separate `GET` and `SET`. |
| A `WITHOUT ROWID` table | The row is stored in the primary-key b-tree, so a view costs exactly **1 row written** and 1 row read. |
| SVG rendered by hand, no libraries | The bundle stays tiny and there are no fonts to fetch. Text widths are estimated from Verdana metrics and fixed with `textLength`. |
| Errors returned as **200** SVGs | camo shows a broken image for responses outside 2xx. A red "invalid user" or "unavailable" badge is easier to diagnose. |
| An allowlist on by default | A public endpoint on a free tier invites others to use up your quota. |

## Free-tier capacity

| Resource | Free limit | Cost per view | Max views/day |
| --- | --- | --- | --- |
| Workers requests | 100,000 / day | 1 | **100,000** ← binding limit |
| D1 rows written | 100,000 / day | 1 | 100,000 |
| D1 rows read | 5,000,000 / day | 1 | 5,000,000 |
| D1 storage | 5 GB | ~50 B per counter | effectively unlimited |

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
src/index.js     routing, counting policy, HTTP headers
src/db.js        the two SQL statements
src/params.js    input validation (GitHub username/repo rules), badge options
src/badge.js     shields-compatible SVG renderer (flat, flat-square, for-the-badge)
migrations/      D1 schema
test/            node:test suite; fake-d1.js runs the real migration on node:sqlite
```
