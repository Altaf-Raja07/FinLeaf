-- Track which model version produced each anomaly alert, so re-scoring with a
-- retrained model is auditable instead of silently overwriting history.
ALTER TABLE anomaly_alerts ADD COLUMN model_version TEXT;

-- One alert per transaction: re-scanning updates the existing row rather than
-- filling the review list with duplicates of the same transaction.
CREATE UNIQUE INDEX anomaly_alerts_user_transaction_uniq
  ON anomaly_alerts (user_id, transaction_id)
  WHERE transaction_id IS NOT NULL;