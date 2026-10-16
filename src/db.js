// Single-statement atomic increment. SQLite serialises writes, so concurrent
// profile views can never overwrite each other (no read-modify-write in JS).
const INCREMENT_SQL = `
  INSERT INTO views (id, count) VALUES (?, 1)
  ON CONFLICT(id) DO UPDATE SET count = count + 1, updated_at = unixepoch()
  RETURNING count`;

const READ_SQL = `SELECT count FROM views WHERE id = ?`;

export async function incrementViews(db, id) {
  const row = await db.prepare(INCREMENT_SQL).bind(id).first();
  return Number(row.count);
}

export async function readViews(db, id) {
  const row = await db.prepare(READ_SQL).bind(id).first();
  return row ? Number(row.count) : 0;
}
