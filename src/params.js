// GitHub username rules: 1-39 chars, alphanumeric or single hyphens,
// cannot start or end with a hyphen.
const USER_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/;
const REPO_RE = /^[a-z0-9._-]{1,100}$/;

const STYLES = new Set(["flat", "flat-square", "for-the-badge"]);
const MAX_LABEL = 40;

/** Resolve ?user=&repo= into a counter id, or an error message for the badge. */
export function parseTarget(params) {
  const user = (params.get("user") ?? params.get("username") ?? "").trim().toLowerCase();
  const repo = (params.get("repo") ?? "").trim().toLowerCase();

  if (!user) return { error: "missing ?user=" };
  if (!USER_RE.test(user)) return { error: "invalid user" };
  if (repo && (!REPO_RE.test(repo) || repo === "." || repo === "..")) return { error: "invalid repo" };

  return { user, id: repo ? `${user}/${repo}` : user };
}

export function parseBadgeOptions(params) {
  const style = params.get("style") ?? "flat";
  const base = Number.parseInt(params.get("base") ?? "0", 10);
  return {
    label: (params.get("label") ?? "Profile views").slice(0, MAX_LABEL),
    color: params.get("color"),
    labelColor: params.get("labelColor") ?? params.get("label_color"),
    style: STYLES.has(style) ? style : "flat",
    abbreviated: isTrue(params.get("abbreviated")),
    // Offset added to the displayed number, e.g. to carry over a count from another service.
    base: Number.isSafeInteger(base) && base > 0 ? base : 0,
  };
}

/** Parse a comma-separated allowlist env var; empty means "anyone". */
export function parseAllowlist(value) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isTrue(value) {
  return value === "1" || value === "true" || value === "yes";
}
