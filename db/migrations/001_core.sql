-- FinLeaf core schema, migration 001.
--
-- Design notes:
--  * Money is stored in minor units (paise) as BIGINT. Floating point is never
--    used for money, so balances cannot drift by a rounding error.
--  * Emission factors are kg CO2e per 100 rupees, matching the proposal's
--    worked example (2,000 rupees of fuel at 2.5 kg/100 = 50 kg CO2e).
--  * No column anywhere stores a real card number, bank credential, Aadhaar, or
--    PAN. `kyc_reference` is a clearly-synthetic demo token.

CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  phone           TEXT        NOT NULL UNIQUE,
  full_name       TEXT        NOT NULL,
  language        TEXT        NOT NULL DEFAULT 'en',
  -- scrypt parameters are stored per-user so they can be raised later without
  -- invalidating existing hashes.
  password_hash   TEXT        NOT NULL,
  password_salt   TEXT        NOT NULL,
  password_params TEXT        NOT NULL,
  -- Synthetic demo token only. Never a government identifier.
  kyc_reference   TEXT        UNIQUE,
  is_demo         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Session tokens are stored hashed, so a database leak does not hand over live
-- sessions. The cookie carries the raw token; only its hash is persisted.
CREATE TABLE sessions (
  id           TEXT        PRIMARY KEY,
  user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT        NOT NULL UNIQUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  user_agent   TEXT
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE accounts (
  id           BIGSERIAL PRIMARY KEY,
  user_id      BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label        TEXT        NOT NULL,
  kind         TEXT        NOT NULL CHECK (kind IN ('wallet', 'savings', 'group')),
  currency     TEXT        NOT NULL DEFAULT 'INR',
  balance      BIGINT      NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX accounts_user_idx ON accounts(user_id);

CREATE TABLE counterparties (
  id            BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  phone         TEXT        NOT NULL,
  -- Cash agents are how many unbanked users reach a real human.
  is_agent      BOOLEAN     NOT NULL DEFAULT FALSE,
  agent_kind    TEXT,
  distance_km   NUMERIC(6,2),
  opens_at      TEXT,
  closes_at     TEXT,
  UNIQUE (owner_user_id, phone)
);

CREATE TABLE transactions (
  id                 BIGSERIAL PRIMARY KEY,
  account_id         BIGINT      NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id            BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction          TEXT        NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount             BIGINT      NOT NULL CHECK (amount > 0),
  category           TEXT        NOT NULL,
  merchant           TEXT        NOT NULL,
  note               TEXT,
  -- set when this row is one side of an internal transfer
  counterparty_id    BIGINT      REFERENCES counterparties(id) ON DELETE SET NULL,
  transfer_group_id  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transactions_user_created_idx ON transactions(user_id, created_at DESC);
CREATE INDEX transactions_user_category_idx ON transactions(user_id, category);
CREATE INDEX transactions_transfer_idx ON transactions(transfer_group_id);

-- Carbon accounting, persisted per transaction so the estimate can always be
-- explained and re-derived rather than being display-only.
CREATE TABLE carbon_estimates (
  transaction_id BIGINT      PRIMARY KEY REFERENCES transactions(id) ON DELETE CASCADE,
  category       TEXT        NOT NULL,
  factor_kg_per_100rupees NUMERIC(8,4) NOT NULL,
  co2e_kg        NUMERIC(12,4) NOT NULL,
  -- 'static' when computed from our own table, 'api' when an external
  -- spend-based provider answered. Never fabricated.
  source         TEXT        NOT NULL DEFAULT 'static' CHECK (source IN ('static', 'api')),
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Green points are a ledger, not a mutable counter, so each award is auditable
-- and a repeated render cannot inflate the balance.
CREATE TABLE green_point_awards (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id BIGINT      REFERENCES transactions(id) ON DELETE CASCADE,
  points         INTEGER     NOT NULL,
  reason         TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One award per qualifying transaction. This is the guard that makes
  -- double-counting a database error rather than a UI bug.
  CONSTRAINT green_award_transaction_uniq UNIQUE (transaction_id)
);
CREATE INDEX green_awards_user_idx ON green_point_awards(user_id);

CREATE TABLE rewards (
  id           BIGSERIAL PRIMARY KEY,
  code         TEXT        NOT NULL UNIQUE,
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL,
  points_cost  INTEGER     NOT NULL CHECK (points_cost > 0),
  kind         TEXT        NOT NULL CHECK (kind IN ('discount', 'donation', 'badge')),
  icon         TEXT        NOT NULL
);

CREATE TABLE reward_redemptions (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reward_id   BIGINT      NOT NULL REFERENCES rewards(id) ON DELETE RESTRICT,
  points_spent INTEGER    NOT NULL CHECK (points_spent > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE savings_goals (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  target_amount  BIGINT      NOT NULL CHECK (target_amount > 0),
  saved_amount   BIGINT      NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  weekly_amount  BIGINT      NOT NULL DEFAULT 0 CHECK (weekly_amount >= 0),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX savings_goals_user_idx ON savings_goals(user_id);

CREATE TABLE goal_contributions (
  id         BIGSERIAL PRIMARY KEY,
  goal_id    BIGINT      NOT NULL REFERENCES savings_goals(id) ON DELETE CASCADE,
  amount     BIGINT      NOT NULL CHECK (amount > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE loan_applications (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  principal      BIGINT      NOT NULL CHECK (principal > 0),
  status         TEXT        NOT NULL CHECK (status IN ('submitted', 'in_review', 'approved', 'repaid', 'declined')),
  trust_score_at_decision INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at     TIMESTAMPTZ
);
CREATE INDEX loan_applications_user_idx ON loan_applications(user_id);

CREATE TABLE trust_score_snapshots (
  id            BIGSERIAL PRIMARY KEY,
  user_id       BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score         INTEGER     NOT NULL CHECK (score BETWEEN 0 AND 100),
  band          TEXT        NOT NULL,
  contributions JSONB       NOT NULL,
  model_version TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX trust_snapshots_user_idx ON trust_score_snapshots(user_id, created_at DESC);

CREATE TABLE anomaly_alerts (
  id             BIGSERIAL PRIMARY KEY,
  user_id        BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id BIGINT      REFERENCES transactions(id) ON DELETE CASCADE,
  score          NUMERIC(6,4) NOT NULL,
  reasons        JSONB       NOT NULL,
  threshold      NUMERIC(6,4) NOT NULL,
  -- 'open' -> user asked to confirm. Never 'blocked': the prototype informs,
  -- it does not stop a transaction.
  status         TEXT        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'disputed')),
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX anomaly_alerts_user_idx ON anomaly_alerts(user_id, status);

CREATE TABLE family_groups (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE family_members (
  group_id   BIGINT      NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL CHECK (role IN ('owner', 'member')),
  visibility TEXT        NOT NULL CHECK (visibility IN ('full', 'pay_bills', 'view')),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE endorsements (
  id           BIGSERIAL PRIMARY KEY,
  endorser_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endorsee_id  BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason       TEXT        NOT NULL,
  points       INTEGER     NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT endorsement_not_self CHECK (endorser_id <> endorsee_id)
);

CREATE TABLE lessons (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT        NOT NULL UNIQUE,
  title       TEXT        NOT NULL,
  summary     TEXT        NOT NULL,
  minutes     INTEGER     NOT NULL,
  body        JSONB       NOT NULL,
  quiz        JSONB       NOT NULL
);

CREATE TABLE quiz_attempts (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  BIGINT      NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  correct    INTEGER     NOT NULL,
  total      INTEGER     NOT NULL,
  passed     BOOLEAN     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_badges (
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_code TEXT        NOT NULL,
  earned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_code)
);

CREATE TABLE offset_projects (
  id             BIGSERIAL PRIMARY KEY,
  code           TEXT        NOT NULL UNIQUE,
  title          TEXT        NOT NULL,
  location       TEXT        NOT NULL,
  points_cost    INTEGER     NOT NULL CHECK (points_cost > 0),
  co2e_kg        NUMERIC(10,2) NOT NULL,
  outcome        TEXT        NOT NULL
);

CREATE TABLE notifications (
  id         BIGSERIAL PRIMARY KEY,
  user_id    BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT        NOT NULL,
  body       TEXT        NOT NULL,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);