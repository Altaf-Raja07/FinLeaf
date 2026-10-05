#!/usr/bin/env node
/**
 * Deterministic demo seed.
 *
 * "Deterministic" means: the same seed produces the same users, balances, and
 * transactions every time, so screenshots stay comparable and the visual QA
 * report is reproducible. A fixed PRNG replaces Math.random throughout.
 *
 * The seed also injects a handful of deliberately anomalous transactions so the
 * anomaly detector has known positives to find.
 *
 * Usage:
 *   node db/seed.mjs            seed if the database is empty
 *   node db/seed.mjs --force    wipe transactional data and reseed
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scryptSync } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ quiet: true });

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "migrations");

// Same PRNG as src/lib/seed-data.ts so both sides agree.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20261005;
const DEMO_PASSWORD = "finleaf123";

// Emission factors, mirrored from src/lib/carbon.ts. Kept as plain numbers here
// so the seed needs no TypeScript loader.
const FACTORS = {
  fuel: 2.5,
  travel: 0.4,
  groceries: 0.5,
  dining: 0.5,
  electronics: 3.2,
  bills: 0.4,
  recharge: 0.1,
  health: 0.3,
  transfer: 0,
};

const GREEN_POINTS = { travel: 12, groceries: 8, recharge: 4, bills: 6, health: 2 };

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { hash: hash.toString("hex"), salt, params: JSON.stringify({ N: 16384, r: 8, p: 1, keylen: 64 }) };
}

function config() {
  return {
    host: process.env.POSTGRES_HOST ?? "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT ?? 55432),
    user: process.env.POSTGRES_USER ?? "finleaf",
    password: process.env.POSTGRES_PASSWORD ?? "finleaf_local_dev",
    database: process.env.POSTGRES_DB ?? "finleaf",
  };
}

/** Apply migrations in-process so `db:seed` works on a fresh checkout. */
async function migrate(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // .sort() rather than a custom comparator: these filenames are all ASCII.
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  const applied = new Set(rows.map((r) => r.filename));
  for (const file of files) {
    if (applied.has(file)) continue;
    await client.query("BEGIN");
    try {
      await client.query(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`[seed] applied migration ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw new Error(`migration ${file} failed: ${err.message}`);
    }
  }
}

const PEOPLE = [
  { name: "Ravi Kumar",  phone: "+919876543210", lang: "en" },
  { name: "Sunita Devi", phone: "+919811122334", lang: "hi" },
  { name: "Anil Traders",phone: "+919765433221", lang: "en" },
  { name: "Meena Kumar", phone: "+919799887766", lang: "kn" },
  { name: "Prakash Patil", phone: "+919345671200", lang: "en" },
  { name: "Fatima Begum", phone: "+919876120033", lang: "hi" },
];

const MERCHANTS = {
  groceries: ["Village Market", "Paddy and vegetables", "Local provision store", "Millet flour stall"],
  travel: ["Bus pass recharge", "City bus ticket", "Auto to bus stand", "Train monthly pass"],
  fuel: ["Diesel", "Petrol pump", "Kerosene"],
  dining: ["Restaurant", "Tea stall", "Roadside tiffin"],
  electronics: ["Headphones", "Phone charger", "LED bulb pack"],
  bills: ["Electricity bill", "Water bill", "Gas cylinder"],
  recharge: ["Mobile recharge", "DTH recharge"],
  health: ["Clinic", "Pharmacy"],
};

async function main() {
  const force = process.argv.includes("--force");
  const client = new pg.Client(config());
  await client.connect();

  try {
    await migrate(client);

    const existing = await client.query("SELECT COUNT(*)::int AS n FROM users");
    if (existing.rows[0].n > 0 && !force) {
      console.log(`[seed] ${existing.rows[0].n} users already present; nothing to do (use --force to reseed)`);
      return;
    }

    if (force) {
      // Reference tables (rewards, lessons, projects) survive a reseed: they are
      // product content, not demo state.
      await client.query("BEGIN");
      await client.query(`
        TRUNCATE users, accounts, counterparties, transactions, carbon_estimates,
                 green_point_awards, reward_redemptions, savings_goals, goal_contributions,
                 loan_applications, trust_score_snapshots, anomaly_alerts, family_groups,
                 family_members, endorsements, quiz_attempts, user_badges, notifications, sessions
        RESTART IDENTITY CASCADE
      `);
      await client.query("COMMIT");
      console.log("[seed] cleared demo data");
    }

    const rng = makeRng(SEED);
    await client.query("BEGIN");

    // --- users ------------------------------------------------------------
    const userIds = [];
    for (const person of PEOPLE) {
      const { hash, salt, params } = hashPassword(DEMO_PASSWORD);
      const { rows } = await client.query(
        `INSERT INTO users (phone, full_name, language, password_hash, password_salt, password_params, kyc_reference, is_demo)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
         RETURNING id`,
        [
          person.phone,
          person.name,
          person.lang,
          hash,
          salt,
          params,
          `DEMO-${person.phone.slice(-4)}`,
        ]
      );
      userIds.push(rows[0].id);
    }
    console.log(`[seed] ${userIds.length} users (password: ${DEMO_PASSWORD})`);

    // --- accounts ---------------------------------------------------------
    const accountIds = [];
    for (const [index, userId] of userIds.entries()) {
      const { rows } = await client.query(
        `INSERT INTO accounts (user_id, label, kind, balance) VALUES ($1, 'Main wallet', 'wallet', 0) RETURNING id`,
        [userId]
      );
      accountIds.push(rows[0].id);

      // The primary demo user gets a savings account too, so the dashboard's
      // "across 2 accounts" figure is real rather than decorative.
      if (index === 0) {
        await client.query(
          `INSERT INTO accounts (user_id, label, kind, balance) VALUES ($1, 'Festival savings', 'savings', 0) RETURNING id`,
          [userId]
        );
      }
    }

    // --- counterparties ----------------------------------------------------
    for (const userId of userIds) {
      for (const other of PEOPLE) {
        if (other.phone.endsWith(userId.toString().slice(-1))) continue;
      }
    }
    // Only the primary user needs a recipient list.
    await client.query(`INSERT INTO counterparties (owner_user_id, name, phone) VALUES
      ($1, 'Sunita Devi', '+919811122334'), ($1, 'Anil Traders', '+919765433221'),
      ($1, 'Meena Kumar', '+919799887766'), ($1, 'Meena Kitchen', '+919799887700')`,
      [userIds[0]]);

    // --- agents ------------------------------------------------------------
    await client.query(`INSERT INTO counterparties (owner_user_id, name, phone, is_agent, agent_kind, distance_km, opens_at, closes_at) VALUES
      ($1, 'Kirana Store - Shantivan', '+919845500011', TRUE, 'Kirana store', 0.4, '07:00', '18:00'),
      ($1, 'FinLeaf Kiosk - Bus Stand', '+919845500022', TRUE, 'Kiosk', 0.9, '06:30', '20:00'),
      ($1, 'Common Service Centre - Main Road', '+919845500033', TRUE, 'Service centre', 1.6, '09:00', '17:00'),
      ($1, 'Bank Mitra - Railway Station', '+919845500044', TRUE, 'Bank correspondent', 2.3, '08:00', '19:00')`,
      [userIds[0]]);

    // --- transactions ------------------------------------------------------
    // Six months of history for the primary user, so trend charts have data.
    const now = Date.now();
    const monthStart = new Date(now);
    monthStart.setDate(1);
    monthStart.setHours(9, 0, 0, 0);

    let inserted = 0;
    let totalPaise = 0;
    // Sentinel so the opening balance below is not mistaken for a real month's
    // salary credit by the guard in the daily loop.
    let lastSalaryMonth = null;

    // Opening balance, so the wallet is never negative on day one.
    // Labelled distinctly from a salary credit so the history reads truthfully.
    const openingAt = new Date(monthStart.getTime() - 26 * 86_400_000);
    openingAt.setHours(9, 0, 0, 0);
    await insertTransaction({
      client,
      accountId: accountIds[0],
      userId: userIds[0],
      direction: "credit",
      amountPaise: 1_500_000,
      category: "transfer",
      merchant: "Opening balance",
      at: openingAt,
    });
    totalPaise += 1_500_000;
    inserted += 1;

    // Recurring spend over the last 150 days.
    //
    // Frequencies are chosen so the demo user comes out as a low-carbon spender
    // who mostly walks, takes the bus, and buys local produce. Fuel is rare on
    // purpose: at 2.5 kg CO2e per 100 rupees it would otherwise dominate the whole
    // footprint and make the monthly figure implausible for this household.
    const plan = [
      { category: "groceries", min: 40000, max: 90000, perWeek: 2 },
      { category: "travel", min: 15000, max: 40000, perWeek: 2 },
      { category: "dining", min: 15000, max: 45000, perWeek: 0.8 },
      { category: "bills", min: 90000, max: 140000, perWeek: 0.2 },
      { category: "recharge", min: 19900, max: 39900, perWeek: 0.25 },
      { category: "health", min: 30000, max: 55000, perWeek: 0.08 },
      { category: "fuel", min: 80000, max: 160000, perWeek: 0.06 },
    ];

    for (let day = 150; day >= 0; day--) {
      const at = new Date(now - day * 86_400_000);
      at.setHours(9 + Math.floor(rng() * 10), Math.floor(rng() * 60), 0, 0);

      // Monthly salary on the 1st. `lastSalaryMonth` guards against a second
      // credit in the same month: without it the boundary between the opening
      // balance and the first real month could pay twice.
      const monthKey = `${at.getFullYear()}-${at.getMonth()}`;
      if (at.getDate() === 1 && monthKey !== lastSalaryMonth) {
        lastSalaryMonth = monthKey;
        await insertTransaction({
          client,
          accountId: accountIds[0],
          userId: userIds[0],
          direction: "credit",
          amountPaise: 1_500_000,
          category: "transfer",
          merchant: "Salary credit",
          at,
        });
        totalPaise += 1_500_000;
        inserted += 1;
      }

      for (const rule of plan) {
        const chance = rule.perWeek / 7;
        if (rng() > chance) continue;
        const amount = Math.round(rule.min + rng() * (rule.max - rule.min));
        const options = MERCHANTS[rule.category];
        const merchant = options[Math.floor(rng() * options.length)];
        await insertTransaction({
          client,
          accountId: accountIds[0],
          userId: userIds[0],
          direction: "debit",
          amountPaise: amount,
          category: rule.category,
          merchant,
          at,
        });
        totalPaise -= amount;
        inserted += 1;
      }
    }

    // Deliberate anomalies for the fraud screen: a large transfer late at night,
    // and a rapid burst of near-identical payments.
    //
    // Placed well before the trend window on purpose. Fuel at 2.5 kg CO2e per 100
    // rupees means one 8,500-rupee diesel transfer is ~212 kg, which would swamp any
    // month it landed in and make the emissions trend meaningless. They still appear
    // on the "Activity to review" screen, which lists anomalies regardless of date,
    // so the fraud flow is fully demonstrable without distorting the carbon figures.
    const anomalies = [
      { amount: 850000, merchant: "Diesel transfer", hour: 23, category: "fuel" },
      { amount: 60000, merchant: "Mobile recharge", hour: 2, category: "recharge" },
      { amount: 59900, merchant: "Mobile recharge", hour: 2, category: "recharge" },
      { amount: 60100, merchant: "Mobile recharge", hour: 2, category: "recharge" },
      { amount: 450000, merchant: "Transfer to unknown", hour: 3, category: "transfer" },
    ];
    for (const a of anomalies) {
      // 200 days back: outside the 5-month trend window shown on the dashboard.
      const at = new Date(now - 200 * 86_400_000);
      at.setHours(a.hour, 47, 0, 0);
      await insertTransaction({
        client,
        accountId: accountIds[0],
        userId: userIds[0],
        direction: "debit",
        amountPaise: a.amount,
        category: a.category,
        merchant: a.merchant,
        at,
      });
      totalPaise -= a.amount;
      inserted += 1;
    }

    console.log(`[seed] ${inserted} transactions for the primary user`);

    // Set the wallet balance to match its ledger exactly.
    await client.query(`UPDATE accounts SET balance = $1 WHERE user_id = $2 AND kind = 'wallet'`, [
      totalPaise,
      userIds[0],
    ]);

    // The savings account gets its opening balance as a real credit row rather
    // than as a bare balance, so "balance = sum(ledger)" holds for every account
    // and a statement can always be shown for it.
    const savingsRow = await client.query(
      `SELECT id FROM accounts WHERE user_id = $1 AND kind = 'savings' LIMIT 1`,
      [userIds[0]]
    );
    if (savingsRow.rows.length > 0) {
      const openedAt = new Date(monthStart.getTime() - 90 * 86_400_000);
      await insertTransaction({
        client,
        accountId: savingsRow.rows[0].id,
        userId: userIds[0],
        direction: "credit",
        amountPaise: 250000,
        category: "transfer",
        merchant: "Opening savings balance",
        at: openedAt,
      });
      await client.query(`UPDATE accounts SET balance = 250000 WHERE id = $1`, [savingsRow.rows[0].id]);
    }

    // Other users get a small balance so transfers have a destination. The
    // balance comes from a real opening credit so the ledger still reconciles.
    for (let i = 1; i < userIds.length; i++) {
      const opening = 50000 + i * 25000;
      await insertTransaction({
        client,
        accountId: accountIds[i],
        userId: userIds[i],
        direction: "credit",
        amountPaise: opening,
        category: "transfer",
        merchant: "Opening balance",
        at: new Date(monthStart.getTime() - 30 * 86_400_000),
      });
      await client.query(`UPDATE accounts SET balance = $1 WHERE id = $2`, [opening, accountIds[i]]);
    }

    // --- savings goals ------------------------------------------------------
    await client.query(
      `INSERT INTO savings_goals (user_id, title, target_amount, saved_amount, weekly_amount) VALUES
       ($1, 'School fees for Meena', 1000000, 680000, 26000),
       ($1, 'New bicycle',        300000, 102000, 10000)`,
      [userIds[0]]
    );

    // --- loans --------------------------------------------------------------
    await client.query(
      `INSERT INTO loan_applications (user_id, principal, status, trust_score_at_decision, created_at, decided_at) VALUES
       ($1, 800000, 'in_review', NULL, now() - interval '3 days', NULL),
       ($1, 500000, 'repaid',     58,  now() - interval '54 days', now() - interval '24 days')`,
      [userIds[0]]
    );

    // --- family group -------------------------------------------------------
    await client.query(`INSERT INTO family_groups (name) VALUES ('Kumar household') RETURNING id`);
    const group = (await client.query(`SELECT id FROM family_groups LIMIT 1`)).rows[0];
    await client.query(
      `INSERT INTO family_members (group_id, user_id, role, visibility) VALUES
       ($1, $2, 'owner', 'full'), ($1, $3, 'member', 'pay_bills'),
       ($1, $4, 'member', 'view'), ($1, $5, 'member', 'view')`,
      [group.id, userIds[0], userIds[1], userIds[3], userIds[4]]
    );

    // --- endorsements -------------------------------------------------------
    await client.query(
      `INSERT INTO endorsements (endorser_id, endorsee_id, reason, points, created_at) VALUES
       ($1, $2, 'Pays her group share on time, every month', 6, now() - interval '2 days'),
       ($3, $2, 'Lent to two members and both repaid',        6, now() - interval '7 days'),
       ($4, $2, 'Never missed a savings week',               5, now() - interval '14 days')`,
      [userIds[1], userIds[0], userIds[2], userIds[3]]
    );

    // --- notifications ------------------------------------------------------
    await client.query(
      `INSERT INTO notifications (user_id, title, body, created_at) VALUES
       ($1, 'Goal progress', 'You are 68% towards School fees for Meena.', now() - interval '2 hours'),
       ($1, 'Green points earned', 'You earned 12 points for taking the bus.', now() - interval '6 hours'),
       ($1, 'Bill due soon', 'Electricity bill of 1,180.00 is due in 2 days.', now() - interval '1 day')`,
      [userIds[0]]
    );

    // --- reconcile ---------------------------------------------------------
    // Every balance must equal the sum of its own ledger. Catching this here
    // means a seeding bug fails loudly instead of producing a demo whose
    // dashboard total disagrees with its own transaction list.
    const drift = await client.query(`
      SELECT a.id, a.balance,
             COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount ELSE -t.amount END), 0)::bigint AS ledger
        FROM accounts a
        LEFT JOIN transactions t ON t.account_id = a.id
       GROUP BY a.id, a.balance
      HAVING a.balance <> COALESCE(SUM(CASE WHEN t.direction = 'credit' THEN t.amount ELSE -t.amount END), 0)
    `);
    if (drift.rowCount > 0) {
      throw new Error(
        `seed produced ${drift.rowCount} account(s) whose balance disagrees with its ledger: ` +
          drift.rows.map((r) => `account ${r.id} balance=${r.balance} ledger=${r.ledger}`).join("; ")
      );
    }

    await client.query("COMMIT");
    console.log("[seed] committed");
    console.log("[seed] verified: every account balance equals its ledger");
    console.log("");
    console.log("  Sign in as the primary demo user:");
    console.log(`    phone    ${PEOPLE[0].phone}`);
    console.log(`    otp      ${process.env.DEMO_OTP ?? "123456"}`);
    console.log("");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[seed] failed: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

/**
 * Insert a transaction plus its carbon estimate and green points.
 *
 * The balance is not touched here: the seed sets account balances once at the
 * end from the running total, which keeps the seeding order irrelevant.
 */
async function insertTransaction({ client, accountId, userId, direction, amountPaise, category, merchant, at }) {
  const { rows } = await client.query(
    `INSERT INTO transactions (account_id, user_id, direction, amount, category, merchant, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [accountId, userId, direction, amountPaise, category, merchant, at]
  );
  const transactionId = rows[0].id;

  if (direction === "debit") {
    const factor = FACTORS[category] ?? 0;
    const co2e = (amountPaise / 100 / 100) * factor;
    await client.query(
      `INSERT INTO carbon_estimates (transaction_id, category, factor_kg_per_100rupees, co2e_kg, source)
       VALUES ($1, $2, $3, $4, 'static')`,
      [transactionId, category, factor, co2e]
    );
    const rate = GREEN_POINTS[category] ?? 0;
    if (rate > 0) {
      const points = Math.floor(amountPaise / 10000) * rate;
      if (points > 0) {
        await client.query(
          `INSERT INTO green_point_awards (user_id, transaction_id, points, reason) VALUES ($1, $2, $3, $4)
           ON CONFLICT (transaction_id) DO NOTHING`,
          [userId, transactionId, points, `${category} purchase`]
        );
      }
    }
  }
}

main();