-- One row per counter. `id` is "<user>" or "<user>/<repo>", always lowercase.
-- WITHOUT ROWID stores the row inside the primary-key b-tree, so each view
-- costs exactly one D1 "row written" (no separate index entry to update).
CREATE TABLE IF NOT EXISTS views (
  id         TEXT    PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
) WITHOUT ROWID;
