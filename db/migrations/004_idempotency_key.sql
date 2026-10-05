-- Dedicated idempotency key for financial operations.
--
-- Previously the key was smuggled into transactions.note with a "__idem:" prefix.
-- That was wrong twice over: it corrupted a user-facing field, and the lookup
-- missed because the marker was written with a leading space and read without
-- one, so a repeated submit could debit a wallet twice.
--
-- A real column with a unique index makes the guarantee a database constraint
-- rather than a string-comparison convention.

ALTER TABLE transactions ADD COLUMN idempotency_key TEXT;

-- One row per key. The partial scope keeps it to sending transactions only, and
-- means two different users cannot collide on the same generated key.
CREATE UNIQUE INDEX transactions_idempotency_uniq
  ON transactions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN transactions.idempotency_key IS
  'Client-supplied key that makes a repeated submit of the same operation a no-op.';