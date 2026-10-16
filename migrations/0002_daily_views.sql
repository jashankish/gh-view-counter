-- Per-day view counts, used by the `card` style's 30-day trend line.
-- `day` is a UTC date string (YYYY-MM-DD) so rows sort chronologically.
CREATE TABLE IF NOT EXISTS daily_views (
  id    TEXT    NOT NULL,
  day   TEXT    NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, day)
) WITHOUT ROWID;
