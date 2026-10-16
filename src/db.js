// Single-statement atomic increments. SQLite serialises writes, so concurrent
// profile views can never overwrite each other (no read-modify-write in JS).
const INCREMENT_SQL = `
  INSERT INTO views (id, count) VALUES (?, 1)
  ON CONFLICT(id) DO UPDATE SET count = count + 1, updated_at = unixepoch()
  RETURNING count`;

const DAILY_SQL = `
  INSERT INTO daily_views (id, day, count) VALUES (?, ?, 1)
  ON CONFLICT(id, day) DO UPDATE SET count = count + 1`;

const READ_SQL = `SELECT count FROM views WHERE id = ?`;
const HISTORY_SQL = `SELECT day, count FROM daily_views WHERE id = ? AND day >= ? ORDER BY day`;

/** Count one view (total + today's bucket) in a single transactional round trip. */
export async function incrementViews(db, id, day) {
  const [total] = await db.batch([
    db.prepare(INCREMENT_SQL).bind(id),
    db.prepare(DAILY_SQL).bind(id, day),
  ]);
  return Number(total.results[0].count);
}

export async function readViews(db, id) {
  const row = await db.prepare(READ_SQL).bind(id).first();
  return row ? Number(row.count) : 0;
}

/** Daily counts for the `days` days ending on `today`, oldest first, zero-filled. */
export async function readHistory(db, id, today, days) {
  const start = shiftDay(today, -(days - 1));
  const { results } = await db.prepare(HISTORY_SQL).bind(id, start).all();
  const byDay = new Map(results.map((r) => [r.day, Number(r.count)]));
  return Array.from({ length: days }, (_, i) => byDay.get(shiftDay(start, i)) ?? 0);
}

export function utcDay(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function shiftDay(day, n) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return utcDay(d);
}
