// Minimal D1 binding backed by Node's built-in SQLite, running the real migrations,
// so tests exercise the exact SQL that ships to Cloudflare.
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";

const MIGRATIONS = new URL("../migrations/", import.meta.url);

export function createFakeD1() {
  const db = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    db.exec(readFileSync(new URL(file, MIGRATIONS), "utf8"));
  }
  return {
    raw: db,
    prepare(sql) {
      return {
        bind(...args) {
          const stmt = db.prepare(sql);
          return {
            first: async () => stmt.get(...args) ?? null,
            run: async () => stmt.run(...args),
            all: async () => ({ results: stmt.all(...args) }),
            _all: () => ({ results: stmt.all(...args) }),
          };
        },
      };
    },
    // Like D1, a batch runs as one transaction and returns a result per statement.
    async batch(statements) {
      db.exec("BEGIN");
      try {
        const results = statements.map((s) => s._all());
        db.exec("COMMIT");
        return results;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  };
}
