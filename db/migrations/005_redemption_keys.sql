-- Idempotency key for redemptions, mirroring transactions.idempotency_key.

ALTER TABLE reward_redemptions ADD COLUMN idempotency_key TEXT;

CREATE UNIQUE INDEX reward_redemptions_idempotency_uniq
  ON reward_redemptions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Offsets are funded with green points, recorded separately from rewards so the
-- rewards balance and the offsets total can each be reported honestly.
CREATE TABLE offset_fundings (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id     BIGINT      NOT NULL REFERENCES offset_projects(id) ON DELETE RESTRICT,
  points_spent   INTEGER     NOT NULL CHECK (points_spent > 0),
  idempotency_key TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT offset_funding_uniq UNIQUE (user_id, idempotency_key)
);