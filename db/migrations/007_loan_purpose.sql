-- Free-text purpose on a loan application, kept so the demo can show what the
-- money was requested for rather than an empty row.
ALTER TABLE loan_applications ADD COLUMN note TEXT;
