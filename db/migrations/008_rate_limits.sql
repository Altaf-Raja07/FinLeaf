-- Rate-limit counters for OTP, registration and money-moving endpoints.
--
-- One row per (key, window bucket) where bucket is the window start timestamp, so
-- the primary key alone gives the fixed-window semantics: once the clock moves to
-- the next bucket, a different row is inserted and the old one is ignored.
--
-- The counter is incremented with a conditional UPDATE (WHERE count < limit), which
-- is what makes admission atomic under concurrency. Two requests arriving at once
-- cannot both read "count = limit - 1" and both be admitted.
CREATE TABLE IF NOT EXISTS rate_limit_counters (
  bucket_key        TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  count             INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0)
);

-- Supports the expired-bucket cleanup that runs on write.
CREATE INDEX IF NOT EXISTS rate_limit_counters_window_idx
  ON rate_limit_counters (window_started_at);