import { renderBadge, renderError, formatCount } from "./badge.js";
import { incrementViews, readViews, readHistory, utcDay } from "./db.js";
import { parseTarget, parseBadgeOptions, parseAllowlist, isTrue } from "./params.js";

// GitHub's camo proxy caches aggressively; these force a fresh fetch per view.
const NO_CACHE_HEADERS = {
  "Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const USAGE = `GitHub view counter

  GET /?user=<github-username>           SVG badge, counts one view
  GET /?user=<name>&repo=<repo>          per-repository counter
  GET /api/views?user=<name>[&repo=]     JSON, read-only
  GET /health                            liveness check

Badge options: style=modern|card|flat|flat-square|for-the-badge, label, color,
               labelColor, theme=auto|light|dark (card), icon=false, animate=false,
               abbreviated=true, base=<offset>, preview=true (don't count)
`;

const HISTORY_DAYS = 30;

export default {
  fetch: (request, env) => handleRequest(request, env),
};

export async function handleRequest(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const url = new URL(request.url);
  switch (url.pathname) {
    case "/":
    case "/badge":
    case "/badge.svg":
      if (!url.searchParams.has("user") && !url.searchParams.has("username")) {
        return new Response(USAGE, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      return badge(request, url, env);
    case "/api/views":
      return apiViews(url, env);
    case "/health":
      return json({ ok: true });
    default:
      return new Response("Not Found", { status: 404 });
  }
}

async function badge(request, url, env) {
  const opts = parseBadgeOptions(url.searchParams);
  const target = parseTarget(url.searchParams);

  // Errors are still rendered as 200 SVGs: camo shows a broken image for non-2xx,
  // and a readable "invalid user" badge is far easier to debug in a README.
  const fail = (message) => svg(renderError(opts, message));

  if (target.error) return fail(target.error);
  if (!isAllowed(target.user, env)) return fail("user not allowed");

  const shouldCount =
    request.method === "GET" &&
    !isTrue(url.searchParams.get("preview")) &&
    (!isTrue(env.COUNT_ONLY_CAMO) || isCamo(request));

  const today = utcDay();
  let views;
  let history = [];
  try {
    views = shouldCount ? await incrementViews(env.DB, target.id, today) : await readViews(env.DB, target.id);
    // Only the card shows history; other styles skip the extra read.
    if (opts.style === "card") history = await readHistory(env.DB, target.id, today, HISTORY_DAYS);
  } catch (err) {
    console.error("D1 error", err);
    return fail("unavailable");
  }

  return svg(
    renderBadge({
      ...opts,
      message: formatCount(views + opts.base, opts.abbreviated),
      history,
      today: history.at(-1) ?? 0,
    }),
  );
}

async function apiViews(url, env) {
  const target = parseTarget(url.searchParams);
  if (target.error) return json({ error: target.error }, 400);
  if (!isAllowed(target.user, env)) return json({ error: "user not allowed" }, 403);
  try {
    const today = utcDay();
    const [views, history] = await Promise.all([
      readViews(env.DB, target.id),
      readHistory(env.DB, target.id, today, HISTORY_DAYS),
    ]);
    return json({ id: target.id, views, today: history.at(-1), history });
  } catch (err) {
    console.error("D1 error", err);
    return json({ error: "unavailable" }, 503);
  }
}

function isAllowed(user, env) {
  const allow = parseAllowlist(env.ALLOWED_USERS);
  return allow.size === 0 || allow.has(user);
}

function isCamo(request) {
  return (request.headers.get("User-Agent") ?? "").toLowerCase().includes("github-camo");
}

function svg(body) {
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...NO_CACHE_HEADERS,
    },
  });
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      ...NO_CACHE_HEADERS,
    },
  });
}
