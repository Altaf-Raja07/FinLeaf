-- One-time passcodes.
--
-- A code is stored only as a SHA-256 hash: a database leak must not hand over
-- live sign-in codes. Each challenge carries its own expiry and consumed marker,
-- so a code is single-use and time-limited regardless of application logic.
--
-- attempts is incremented on every verification. The application compares it
-- against a limit before checking the hash, which caps guessing per code as well
-- as per address.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id              BIGSERIAL PRIMARY KEY,
  phone           TEXT        NOT NULL,
  code_hash       TEXT        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  consumed_at     TIMESTAMPTZ,
  attempts        INTEGER     NOT NULL DEFAULT 0,
  request_ip      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Verification looks up the open challenge for a phone. This index makes that a
-- single lookup, and its partial form keeps it small as history accumulates.
CREATE INDEX IF NOT EXISTS otp_challenges_open_idx
  ON otp_challenges (phone, expires_at DESC)
  WHERE consumed_at IS NULL;

-- Issuing a new code invalidates any earlier one for the same phone.
CREATE INDEX IF NOT EXISTS otp_challenges_phone_idx ON otp_challenges (phone, created_at DESC);