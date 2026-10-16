// Minimal D1 binding backed by Node's built-in SQLite, running the real migration,
// so tests exercise the exact SQL that ships to Cloudflare.
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

const MIGRATION = new URL("../migrations/0001_create_views.sql", import.meta.url);

export function createFakeD1() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(MIGRATION, "utf8"));
  return {
    raw: db,
    prepare(sql) {
      return {
        bind(...args) {
          const stmt = db.prepare(sql);
          return {
            first: async () => stmt.get(...args) ?? null,
            run: async () => stmt.run(...args),
          };
        },
      };
    },
  };
}
