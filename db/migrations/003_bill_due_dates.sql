-- Add a due date to bill and recharge payments.
--
-- On-time bill payment is one of the five trust-score factors, and it cannot be
-- computed honestly without knowing when a bill was actually due. The previous
-- proxy compared the payment date with "now", which measured how recently someone
-- paid rather than whether they paid on time.

ALTER TABLE transactions ADD COLUMN due_at TIMESTAMPTZ;

-- Only bill and recharge rows carry a due date; it stays null for everything else.
ALTER TABLE transactions
  ADD CONSTRAINT transactions_due_at_only_for_bills
  CHECK (due_at IS NULL OR category IN ('bills', 'recharge'));

-- Partial index: the trust-score query only ever scans bill rows.
CREATE INDEX transactions_due_at_idx
  ON transactions (user_id, created_at DESC)
  WHERE due_at IS NOT NULL;

COMMENT ON COLUMN transactions.due_at IS
  'Simulated due date for a bill or recharge. Null for non-bill categories.';