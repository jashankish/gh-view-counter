# gh-view-counter

A self-hosted, zero-cost GitHub profile view counter. It is one Cloudflare Worker (~200 lines, no runtime dependencies) plus one Cloudflare D1 table.

```markdown
![Profile views](https://gh-view-counter.<your-subdomain>.workers.dev/?user=jashankish)
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the design and the free-tier math. Open [docs/free-tier-calculator.html](docs/free-tier-calculator.html) in a browser to compare stacks at different traffic levels.

## Deploy (about 10 minutes, free)

You need a free Cloudflare account and Node.js 22.5 or newer.

```bash
npm install
npx wrangler login                 # opens the browser once
npm run db:create                  # prints a database_id
#   → paste that id into wrangler.toml under [[d1_databases]]
npm run db:migrate                 # creates the `views` table in D1
npm run deploy                     # prints https://gh-view-counter.<subdomain>.workers.dev
```

Then add the badge to the `README.md` in your `jashankish/jashankish` repository.

### Optional: deploy on every push

`.github/workflows/deploy.yml` runs the tests, then applies migrations and deploys whenever you push to `main`. To use it, add two repository secrets:

* `CLOUDFLARE_API_TOKEN`: create it from the "Edit Cloudflare Workers" template and add the **D1: Edit** permission.
* `CLOUDFLARE_ACCOUNT_ID`

## Usage

| Endpoint | What it does |
| --- | --- |
| `GET /?user=<name>` | Counts one view and returns an SVG badge |
| `GET /?user=<name>&repo=<repo>` | Separate counter for a repository README |
| `GET /api/views?user=<name>[&repo=]` | JSON `{id, views}`; does not count a view |
| `GET /health` | `{ok:true}` |

### Badge options

| Param | Default | Example |
| --- | --- | --- |
| `label` | `Profile views` | `label=Visitors`; `label=` shows no label |
| `color` | `blue` | named (`brightgreen`, `orange`, `red`, …) or hex `ff69b4` |
| `labelColor` | `555` | same formats as `color` |
| `style` | `flat` | `flat-square`, `for-the-badge` |
| `abbreviated` | `false` | `true` turns `12,345` into `12k` |
| `base` | `0` | `base=1500` adds an offset, e.g. to carry over a count from komarev |
| `preview` | `false` | `true` shows the count without counting a view |

```markdown
![Visitors](https://…workers.dev/?user=jashankish&label=Visitors&color=brightgreen&style=for-the-badge)
```

## Configuration (`wrangler.toml` → `[vars]`)

| Var | Default | Purpose |
| --- | --- | --- |
| `ALLOWED_USERS` | `jashankish` | Comma-separated usernames allowed to have counters. Without it, anyone could point badges at your Worker and use up your free quota. Set it to `""` to run a public service. |
| `COUNT_ONLY_CAMO` | `false` | With `true`, only requests from GitHub's `camo` image proxy count a view. Opening the badge URL directly then shows the count without raising it. |

## Develop

```bash
npm test                  # 13 tests run the real migration SQL on node:sqlite
npm run db:migrate:local
npm run dev               # http://localhost:8787/?user=jashankish
```

## Limitations

* **It counts page loads, not unique visitors.** Every request arrives from GitHub's camo proxy, so the Worker never sees a visitor's IP address or cookies.
* **Anyone can raise the count** by requesting the URL in a loop. Every public view counter has this problem. `COUNT_ONLY_CAMO` only filters out casual inflation, because a User-Agent header can be faked.
