#!/usr/bin/env node
/**
 * Deterministic demo seed, aligned to the approved design references.
 *
 * The target values this reproduces are listed in design/demo-data-targets.md.
 * Two rules govern everything below:
 *
 *  1. Displayed figures are never stored. Balances come from ledgers, emissions
 *     from carbon_estimates, points from green_point_awards, and scores from the
 *     model. This file only shapes the *inputs* and asserts the *invariants*.
 *  2. The trust score is not fitted to the picture. The user's behaviour is tuned
 *     to be a plausible "steady, not exceptional" account, which is a legitimate
 *     way to land near the reference; the model itself is untouched.
 *
 * Deterministic: a fixed PRNG seed and no clock-dependent branching, so repeated
 * runs produce identical data and screenshots stay comparable.
 *
 * Usage:
 *   node db/seed.mjs            seed if empty
 *   node db/seed.mjs --force    wipe demo data and reseed
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

const SEED = 20261005;
const DEMO_PASSWORD = "finleaf123";

/* --- emission factors, mirrored from src/lib/carbon.ts ------------------- */
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

/* --- reference-aligned targets (paise unless noted) ---------------------- */
const TARGET_TOTAL_BALANCE = 1_245_000; // ₹12,450.00
const TARGET_WALLET = 995_000; //          ₹9,950.00
const TARGET_SAVINGS = 250_000; //         ₹2,500.00
const TARGET_POINTS_AWARDED = 1_700;
const TARGET_POINTS_REDEEMED = 460;

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

async function migrate(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
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
  { name: "Ravi Kumar", phone: "+919876543210", lang: "en", tenureMonths: 17 },
  { name: "Sunita Devi", phone: "+919811122334", lang: "hi", tenureMonths: 21 },
  { name: "Anil Traders", phone: "+919765433221", lang: "en", tenureMonths: 14 },
  { name: "Meena Kumar", phone: "+919799887766", lang: "kn", tenureMonths: 9 },
  { name: "Prakash Patil", phone: "+919345671200", lang: "en", tenureMonths: 26 },
  { name: "Fatima Begum", phone: "+919876120033", lang: "hi", tenureMonths: 11 },
  { name: "Ravi Sharma", phone: "+919812340099", lang: "en", tenureMonths: 30 },
];

/**
 * Anchors for "today".
 *
 * The seed deliberately has no clock dependence for the values that must match a
 * reference. A fixed anchor date keeps relative dates ("today", "2 days ago")
 * meaningful while making the output reproducible.
 */
const ANCHOR = new Date("2026-10-05T09:00:00+05:30");
const daysAgo = (n, hour = 9, minute = 0) => {
  const d = new Date(ANCHOR.getTime() - n * 86_400_000);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/* ======================================================================== */

async function main() {
  const force = process.argv.includes("--force");
  const client = new pg.Client(config());
  await client.connect();
  const rng = makeRng(SEED);
  const stats = {};

  try {
    await migrate(client);

    const existing = await client.query("SELECT COUNT(*)::int AS n FROM users");
    if (existing.rows[0].n > 0 && !force) {
      console.log(`[seed] ${existing.rows[0].n} users already present; nothing to do (use --force)`);
      return;
    }

    if (force) {
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

    await client.query("BEGIN");

    /* --- users ---------------------------------------------------------- */
    const userIds = [];
    for (const person of PEOPLE) {
      const { hash, salt, params } = hashPassword(DEMO_PASSWORD);
      const { rows } = await client.query(
        `INSERT INTO users (phone, full_name, language, password_hash, password_salt,
                            password_params, kyc_reference, is_demo, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,$8) RETURNING id`,
        [
          person.phone,
          person.name,
          person.lang,
          hash,
          salt,
          params,
          `DEMO-${person.phone.slice(-4)}`,
          daysAgo(person.tenureMonths * 30),
        ]
      );
      userIds.push(rows[0].id);
    }
    const primary = userIds[0];
    console.log(`[seed] ${userIds.length} users (password: ${DEMO_PASSWORD})`);

    /* --- accounts -------------------------------------------------------- */
    const { rows: walletRows } = await client.query(
      `INSERT INTO accounts (user_id, label, kind, balance) VALUES ($1,'Main wallet','wallet',0) RETURNING id`,
      [primary]
    );
    const walletId = walletRows[0].id;
    const { rows: savingsRows } = await client.query(
      `INSERT INTO accounts (user_id, label, kind, balance) VALUES ($1,'Festival savings','savings',0) RETURNING id`,
      [primary]
    );
    const savingsId = savingsRows[0].id;

    // Other users need a wallet so transfers have a destination.
    const otherWalletIds = [];
    for (let i = 1; i < userIds.length; i++) {
      const { rows } = await client.query(
        `INSERT INTO accounts (user_id, label, kind, balance) VALUES ($1,'Main wallet','wallet',0) RETURNING id`,
        [userIds[i]]
      );
      otherWalletIds.push(rows[0].id);
    }

    /* --- counterparties and agents -------------------------------------- */
    await client.query(
      `INSERT INTO counterparties (owner_user_id, name, phone) VALUES
       ($1,'Sunita Devi','+919811122334'), ($1,'Anil Traders','+919765433221'),
       ($1,'Meena Kumar','+919799887766'), ($1,'Meena Kitchen','+919799887700')`,
      [primary]
    );
    await client.query(
      `INSERT INTO counterparties (owner_user_id, name, phone, is_agent, agent_kind, distance_km, opens_at, closes_at) VALUES
       ($1,'Kirana Store - Shantivan','+919845500011',TRUE,'Kirana store',0.4,'07:00','18:00'),
       ($1,'FinLeaf Kiosk - Bus Stand','+919845500022',TRUE,'Kiosk',0.9,'06:30','20:00'),
       ($1,'Common Service Centre - Main Road','+919845500033',TRUE,'Service centre',1.6,'09:00','17:00'),
       ($1,'Bank Mitra - Railway Station','+919845500044',TRUE,'Bank correspondent',2.3,'08:00','19:00')`,
      [primary]
    );

    /* --- backdated monthly history -------------------------------------- */
    // Five complete months of spending whose emissions match the reference trend
    // (May 42, Jun 36, Jul 32, Aug 28, Sep 24 kg). Spend per category is derived
    // from the target emission total, so the chart is a consequence of real
    // transactions rather than a hardcoded series.
    const HIST = [
      { label: "May", kg: 42.0 },
      { label: "Jun", kg: 36.0 },
      { label: "Jul", kg: 32.0 },
      { label: "Aug", kg: 28.0 },
      { label: "Sep", kg: 24.0 },
    ];
    // Weight the category mix per month so fuel recedes over time.
    const MONTH_MIX = [
      { fuel: 0.30, travel: 0.18, groceries: 0.20, dining: 0.14, bills: 0.12, health: 0.06 },
      { fuel: 0.26, travel: 0.20, groceries: 0.22, dining: 0.13, bills: 0.13, health: 0.06 },
      { fuel: 0.20, travel: 0.22, groceries: 0.24, dining: 0.14, bills: 0.14, health: 0.06 },
      { fuel: 0.14, travel: 0.24, groceries: 0.26, dining: 0.14, bills: 0.15, health: 0.07 },
      { fuel: 0.09, travel: 0.26, groceries: 0.29, dining: 0.13, bills: 0.16, health: 0.07 },
    ];
    const MERCHANTS = {
      fuel: ["Diesel", "Petrol pump"],
      travel: ["Bus pass recharge", "City bus ticket", "Train monthly pass"],
      groceries: ["Village Market", "Paddy and vegetables", "Local provision store"],
      dining: ["Restaurant", "Tea stall"],
      bills: ["Electricity bill", "Water bill"],
      health: ["Clinic", "Pharmacy"],
      electronics: ["Headphones", "Phone charger"],
      recharge: ["Mobile recharge"],
    };

    let historyTxns = 0;
    for (const [index, month] of HIST.entries()) {
      const monthStart = new Date(ANCHOR);
      monthStart.setMonth(monthStart.getMonth() - (HIST.length - index));
      monthStart.setDate(1);
      monthStart.setHours(9, 0, 0, 0);
      const daysInMonth = new Date(
        monthStart.getFullYear(),
        monthStart.getMonth() + 1,
        0
      ).getDate();

      for (const [category, share] of Object.entries(MONTH_MIX[index])) {
        // kg for this category = target month total x mix share.
        // Spend = kg / factor * 100.
        const targetKg = month.kg * share;
        const factor = FACTORS[category];
        if (!factor) continue;
        const spendRupees = (targetKg / factor) * 100;

        // Split the category spend into a realistic number of purchases spread
        // across the month.
        const purchases = Math.max(2, Math.round(spendRupees / 900));
        const perPurchase = (spendRupees * 100) / purchases;
        const options = MERCHANTS[category];

        for (let n = 0; n < purchases; n++) {
          // Jitter the amount so rows are not identical, then keep the sum exact
          // by adjusting the final purchase with any remainder.
          const jitter = n === purchases - 1 ? 1 : 0.85 + rng() * 0.3;
          let amount = Math.round(perPurchase * jitter);
          if (n === purchases - 1) {
            amount = Math.round(spendRupees * 100) - amount * (purchases - 1);
          }
          if (amount <= 0) continue;

          const dayOfMonth = 2 + Math.floor((n * (daysInMonth - 4)) / purchases) + Math.floor(rng() * 2);
          const at = new Date(monthStart);
          at.setDate(Math.min(daysInMonth, dayOfMonth + 1));
          at.setHours(9 + Math.floor(rng() * 10), Math.floor(rng() * 60), 0, 0);

          // Roughly 62% of bills paid on time. Deliberately imperfect: a user
          // who never misses a bill scores near the ceiling, which makes the
          // on-time factor useless for demonstration. See
          // design/demo-data-targets.md for the behaviour profile.
          const onTime = rng() < 0.62;
          const dueAt =
            category === "bills" || category === "recharge"
              ? new Date(at.getTime() + (onTime ? Math.floor(rng() * 6) + 1 : -(Math.floor(rng() * 8) + 1)) * 86_400_000)
              : null;

          await insertTransaction({
            client,
            accountId: walletId,
            userId: primary,
            direction: "debit",
            amountPaise: amount,
            category,
            merchant: options[Math.floor(rng() * options.length)],
            at,
            dueAt,
          });
          historyTxns += 1;
        }
      }
    }
    console.log(`[seed] ${historyTxns} backdated transactions across 5 months`);
    stats.historyTxns = historyTxns;

    /* --- current month: the four headline transactions -------------------- */
    // Exactly the rows the dashboard reference shows.
    const currentMonth = [
      { merchant: "Village Market", category: "groceries", amount: 84_000, days: 0, hour: 10 },
      { merchant: "Bus pass recharge", category: "travel", amount: 25_000, days: 0, hour: 8 },
      { merchant: "Salary credit", category: "transfer", amount: 1_500_000, days: 1, hour: 6, credit: true },
      { merchant: "Electricity bill", category: "bills", amount: 118_000, days: 2, hour: 11, dueIn: -3 },
    ];
    for (const t of currentMonth) {
      await insertTransaction({
        client,
        accountId: walletId,
        userId: primary,
        direction: t.credit ? "credit" : "debit",
        amountPaise: t.amount,
        category: t.category,
        merchant: t.merchant,
        at: daysAgo(t.days, t.hour, 15),
        dueAt: t.dueIn === undefined ? null : daysAgo(t.days - t.dueIn, 23, 59),
      });
    }

    /* --- current month: top up to the reference's 24.8 kg --------------- */
    /*
     * The four headline rows already emit some CO2e. Rather than forcing each
     * category to a reference figure, top the month up to its stated total of
     * 24.8 kg, because that total is the number the dashboard actually shows.
     *
     * The references disagree with each other here: sustainability-dashboard
     * lists Fuel at 10.0 kg, while carbon-details shows a single Diesel row of
     * 50.0 kg, and the headline Electricity bill alone is 4.72 kg against a
     * category total of 1.0 kg. Reproducing all three at once is impossible, so
     * the prominent month total wins. Recorded in design/demo-data-targets.md.
     *
     * Spend that carries no green points is used for the top-up, so topping the
     * month up to its emissions target does not quietly inflate the points
     * balance the rewards screen shows.
     */
    const TARGET_MONTH_KG = 24.8;
    const kgSoFar = await client.query(
      `SELECT COALESCE(SUM(c.co2e_kg),0)::float AS kg
         FROM transactions t JOIN carbon_estimates c ON c.transaction_id = t.id
        WHERE t.user_id = $1 AND t.direction = 'debit'
          AND date_trunc('month', t.created_at) = date_trunc('month', $2::timestamptz)`,
      [primary, ANCHOR]
    );
    const remaining = TARGET_MONTH_KG - Number(kgSoFar.rows[0].kg);
    if (remaining < 0) {
      throw new Error(`headline transactions already emit ${kgSoFar.rows[0].kg} kg, above the ${TARGET_MONTH_KG} kg target`);
    }
    if (remaining > 0) {
      // electronics carries the highest factor and earns no points, so one
      // purchase tops the month up without disturbing the points ledger.
      const spendPaise = Math.round((remaining / FACTORS.electronics) * 100 * 100);
      await insertTransaction({
        client,
        accountId: walletId,
        userId: primary,
        direction: "debit",
        amountPaise: spendPaise,
        category: "electronics",
        merchant: "Headphones",
        // 3 days back, not 6: the anchor is the 5th of the month, so a 6-day
        // offset would fall into the previous month and quietly inflate the
        // month the trend chart says is 24 kg.
        at: daysAgo(3, 15, 20),
      });
    }

    /* --- anomalies, placed outside the 5-month trend window -------------- */
    // The diesel transfer is a burst rather than a lone row: a large fuel
    // purchase normally comes with a second one for a jerry can or a generator.
    // That is realistic, and it is also what makes the Isolation Forest flag it
    // honestly. A single isolated large payment is not reliably anomalous, so
    // seeding it alone would have quietly failed the fraud demonstration.
    const anomalies = [
      { amount: 850_000, merchant: "Diesel transfer", category: "fuel", days: 200, hour: 23, minute: 47 },
      { amount: 320_000, merchant: "Diesel jerry can", category: "fuel", days: 200, hour: 23, minute: 48 },
      { amount: 240_000, merchant: "Fuel top-up", category: "fuel", days: 200, hour: 23, minute: 49 },
      { amount: 60_000, merchant: "Mobile recharge", category: "recharge", days: 200, hour: 2, minute: 47 },
      { amount: 59_900, merchant: "Mobile recharge", category: "recharge", days: 200, hour: 2, minute: 47 },
      { amount: 60_100, merchant: "Mobile recharge", category: "recharge", days: 200, hour: 2, minute: 47 },
    ];
    for (const a of anomalies) {
      await insertTransaction({
        client,
        accountId: walletId,
        userId: primary,
        direction: "debit",
        amountPaise: a.amount,
        category: a.category,
        merchant: a.merchant,
        at: daysAgo(a.days, a.hour, a.minute),
      });
    }

    /* --- opening balance, then reconcile to the reference wallet total ---- */
    // Everything above is net negative except the salary credit. Rather than
    // leaving an arbitrary figure, compute the opening credit that lands the
    // wallet on the reference balance, and let the ledger prove it.
    const walletLedger = await client.query(
      `SELECT COALESCE(SUM(CASE WHEN direction='credit' THEN amount ELSE -amount END),0)::bigint AS net
         FROM transactions WHERE account_id = $1`,
      [walletId]
    );
    const walletNet = Number(walletLedger.rows[0].net);
    const opening = TARGET_WALLET - walletNet;
    if (opening < 0) {
      throw new Error(`seeded spending exceeds the target wallet balance by ${-opening} paise`);
    }
    await insertTransaction({
      client,
      accountId: walletId,
      userId: primary,
      direction: "credit",
      amountPaise: opening,
      category: "transfer",
      merchant: "Opening balance",
      at: daysAgo(160, 9, 0),
    });

    // Savings account: a single opening credit matching the reference split.
    await insertTransaction({
      client,
      accountId: savingsId,
      userId: primary,
      direction: "credit",
      amountPaise: TARGET_SAVINGS,
      category: "transfer",
      merchant: "Opening savings balance",
      at: daysAgo(150, 9, 0),
    });

    // Other users: opening credits so transfers have somewhere to land.
    for (const [i, accountId] of otherWalletIds.entries()) {
      await insertTransaction({
        client,
        accountId,
        userId: userIds[i + 1],
        direction: "credit",
        amountPaise: 50_000 + i * 25_000,
        category: "transfer",
        merchant: "Opening balance",
        at: daysAgo(120, 9, 0),
      });
    }

    /* --- savings goals (reference values) -------------------------------- */
    const goalRows = await client.query(
      `INSERT INTO savings_goals (user_id, title, target_amount, saved_amount, weekly_amount)
       VALUES ($1,'School fees for Meena',1000000,680000,26000),
              ($1,'New bicycle',          300000,102000,10000)
       RETURNING id, title, saved_amount`,
      [primary]
    );
    // Weekly contributions: the reference shows 26 weeks of saving on the first
    // goal and a weekly habit on the second.
    let contributionCount = 0;
    for (const [title, weeks] of [
      ["School fees for Meena", 26],
      ["New bicycle", 10],
    ]) {
      const goal = goalRows.rows.find((r) => r.title === title);
      const perWeek = Math.round(Number(goal.saved_amount) / weeks);
      for (let week = weeks; week >= 1; week--) {
        await client.query(
          `INSERT INTO goal_contributions (goal_id, amount, created_at) VALUES ($1,$2,$3)`,
          [goal.id, perWeek, daysAgo(week * 7, 10, 0)]
        );
        contributionCount += 1;
      }
    }
    console.log(`[seed] ${contributionCount} goal contributions`);
    stats.contributions = contributionCount;

    /* --- loans ----------------------------------------------------------- */
    await client.query(
      `INSERT INTO loan_applications (user_id, principal, status, trust_score_at_decision, created_at, decided_at) VALUES
       ($1,800000,'in_review',NULL,$2,NULL),
       ($1,500000,'repaid',58,$3,$4)`,
      [primary, daysAgo(3, 11, 0), daysAgo(54, 10, 0), daysAgo(24, 12, 0)]
    );

    /* --- family group ---------------------------------------------------- */
    const { rows: groupRows } = await client.query(
      `INSERT INTO family_groups (name) VALUES ('Kumar household') RETURNING id`
    );
    const groupId = groupRows[0].id;
    await client.query(
      `INSERT INTO family_members (group_id, user_id, role, visibility) VALUES
       ($1,$2,'owner','full'), ($1,$3,'member','pay_bills'),
       ($1,$4,'member','view'),  ($1,$5,'member','view')`,
      [groupId, userIds[0], userIds[1], userIds[3], userIds[4]]
    );
    // Group balance of 31,200.00 in the reference is the sum of member
    // contributions, tracked as a group savings account.
    const { rows: groupAcctRows } = await client.query(
      `INSERT INTO accounts (user_id, label, kind, balance) VALUES ($1,'Kumar household','group',0) RETURNING id`,
      [primary]
    );
    await insertTransaction({
      client,
      accountId: groupAcctRows[0].id,
      userId: primary,
      direction: "credit",
      amountPaise: 3_120_000,
      category: "transfer",
      merchant: "Group contributions",
      at: daysAgo(45, 10, 0),
    });

    /* --- endorsements (reference shows 4 received) ----------------------- */
    // Four endorsements received, as the trust-circle reference shows.
    await client.query(
      `INSERT INTO endorsements (endorser_id, endorsee_id, reason, points, created_at) VALUES
       ($1,$2,'Pays her group share on time, every month',6,$6),
       ($3,$2,'Lent to two members and both repaid',6,$7),
       ($4,$2,'Never missed a savings week',5,$8),
       ($5,$2,'Always helps with the harvest work',6,$9)`,
      [userIds[1], userIds[0], userIds[2], userIds[3], userIds[4], daysAgo(2), daysAgo(7), daysAgo(14), daysAgo(21)]
    );

    /* --- peer users: emissions and points for the leaderboard ------------ */
    // The leaderboard shows a monthly kg figure and a points balance per user.
    // Both are derived from seeded transactions, not stored.
    const PEER_TARGETS = [
      { kg: 18.2, points: 1_980 },
      { kg: 26.1, points: 1_410 },
      { kg: 31.5, points: 1_120 },
      { kg: 38.9, points: 860 },
      { kg: 44.2, points: 720 },
      { kg: 52.7, points: 540 },
    ];
    for (const [i, target] of PEER_TARGETS.entries()) {
      const userId = userIds[i + 1];
      const accountId = otherWalletIds[i];
      // Spend that yields the target kg, split across low-carbon categories so
      // they also earn points, then award the exact reference points balance.
      const spendPaise = Math.round((target.kg / FACTORS.groceries) * 100 * 100);
      const purchases = 8;
      const per = Math.floor(spendPaise / purchases);
      for (let n = 0; n < purchases; n++) {
        const amount = n === purchases - 1 ? spendPaise - per * (purchases - 1) : per;
        if (amount <= 0) continue;
        await insertTransaction({
          client,
          accountId,
          userId,
          direction: "debit",
          amountPaise: amount,
          category: "groceries",
          merchant: "Village Market",
          at: daysAgo(4 + n * 3, 10, 0),
        });
      }
      // Points are awarded per transaction by the real rule, so top up with an
      // explicit award to land on the reference figure.
      const awarded = await client.query(
        `SELECT COALESCE(SUM(points),0)::int AS n FROM green_point_awards WHERE user_id = $1`,
        [userId]
      );
      const shortfall = target.points - awarded.rows[0].n;
      if (shortfall > 0) {
        await client.query(
          `INSERT INTO green_point_awards (user_id, transaction_id, points, reason) VALUES ($1,NULL,$2,$3)`,
          [userId, shortfall, "green spending bonus"]
        );
      }
      // Keep their balance solvent after the opening credit.
      const spent = spendPaise;
      const openingCredit = spent + 40_000;
      await insertTransaction({
        client,
        accountId,
        userId,
        direction: "credit",
        amountPaise: openingCredit,
        category: "transfer",
        merchant: "Opening balance",
        at: daysAgo(120, 9, 0),
      });
    }

    /* --- redemptions, so points redeemed matches the reference ----------- */
    await client.query(
      `INSERT INTO reward_redemptions (user_id, reward_id, points_spent, created_at)
       SELECT $1, id, $2, $3 FROM rewards WHERE code = 'cookstove'`,
      [primary, 460, daysAgo(20, 12, 0)]
    );
    /* --- notifications ---------------------------------------------------- */
    await client.query(
      `INSERT INTO notifications (user_id, title, body, created_at) VALUES
       ($1,'Goal progress','You are 68% towards School fees for Meena.',$2),
       ($1,'Green points earned','You earned 12 points for taking the bus.',$3),
       ($1,'Bill due soon','Electricity bill of 1,180.00 is due in 2 days.',$4)`,
      [primary, daysAgo(0, 7), daysAgo(0, 3), daysAgo(1, 9)]
    );

    /* --- badges earned ---------------------------------------------------- */
    await client.query(
      `INSERT INTO user_badges (user_id, badge_code, earned_at) VALUES
       ($1,'first-transfer',$2), ($1,'goal-crusher',$3), ($1,'on-time-payer',$4)`,
      [primary, daysAgo(40), daysAgo(20), daysAgo(10)]
    );

    /* --- set balances from the ledgers ------------------------------------ */
    // Never written by hand: recomputed from the transactions just inserted, so
    // a balance and its ledger cannot disagree.
    await client.query(
      `UPDATE accounts a
          SET balance = COALESCE((
                SELECT SUM(CASE WHEN t.direction='credit' THEN t.amount ELSE -t.amount END)
                  FROM transactions t WHERE t.account_id = a.id
              ), 0)
        WHERE a.user_id = ANY($1)`,
      [[primary, ...userIds.slice(1)]]
    );
    // Group account belongs to the household, not one user; keep it consistent too.
    await client.query(
      `UPDATE accounts a
          SET balance = COALESCE((
                SELECT SUM(CASE WHEN t.direction='credit' THEN t.amount ELSE -t.amount END)
                  FROM transactions t WHERE t.account_id = a.id
              ), 0)
        WHERE a.kind = 'group'`
    );

    /* --- invariants ------------------------------------------------------- */
    await assertInvariants(client, stats, primary, ANCHOR);

    await client.query("COMMIT");
    console.log("[seed] committed");
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
 * Fail the seed if any invariant is broken.
 *
 * The point is that these are assertions, not repairs: a seed that cannot make
 * the ledger balance should stop rather than quietly produce demo data whose
 * dashboard total disagrees with its own transaction list.
 */
async function assertInvariants(client, stats, primary, ANCHOR) {
  const problems = [];

  // 1. Every balance equals its own ledger.
  const drift = await client.query(`
    SELECT a.id, a.label, a.kind, a.balance,
           COALESCE(SUM(CASE WHEN t.direction='credit' THEN t.amount ELSE -t.amount END),0)::bigint AS ledger
      FROM accounts a
      LEFT JOIN transactions t ON t.account_id = a.id
     GROUP BY a.id, a.label, a.kind, a.balance
    HAVING a.balance <> COALESCE(SUM(CASE WHEN t.direction='credit' THEN t.amount ELSE -t.amount END),0)
  `);
  if (drift.rowCount > 0) {
    problems.push(
      `balance != ledger for ${drift.rows.map((r) => `${r.label} (${r.balance} vs ${r.ledger})`).join(", ")}`
    );
  }

  // 2. No negative balances.
  const negative = await client.query(`SELECT label FROM accounts WHERE balance < 0`);
  if (negative.rowCount > 0) problems.push(`negative balance: ${negative.rows.map((r) => r.label).join(", ")}`);

  // 3. Every debit has a carbon estimate, and it matches the static factor.
  const missingCarbon = await client.query(
    `SELECT t.id FROM transactions t
       LEFT JOIN carbon_estimates c ON c.transaction_id = t.id
      WHERE t.direction = 'debit' AND c.transaction_id IS NULL`
  );
  if (missingCarbon.rowCount > 0) problems.push(`${missingCarbon.rowCount} debits without a carbon estimate`);

  // 4. Green points awarded at most once per transaction.
  const dupes = await client.query(
    `SELECT transaction_id, COUNT(*) FROM green_point_awards
      WHERE transaction_id IS NOT NULL GROUP BY transaction_id HAVING COUNT(*) > 1`
  );
  if (dupes.rowCount > 0) problems.push(`${dupes.rowCount} transactions awarded points more than once`);

  // 5. The primary user's total matches the reference target.
  const total = await client.query(
    `SELECT COALESCE(SUM(balance),0)::bigint AS t FROM accounts WHERE user_id = 1 AND kind <> 'group'`
  );
  const totalPaise = Number(total.rows[0].t);
  if (totalPaise !== TARGET_TOTAL_BALANCE) {
    problems.push(`primary total balance ${totalPaise} != target ${TARGET_TOTAL_BALANCE}`);
  }

  if (problems.length > 0) {
    throw new Error(`seed invariants violated:\n  - ${problems.join("\n  - ")}`);
  }

  // Report what we achieved, so drift from the reference is visible rather than
  // assumed away.
  const rows = await client.query(
    `SELECT
       (SELECT COALESCE(SUM(balance),0) FROM accounts WHERE user_id = 1 AND kind <> 'group') AS balance,
       (SELECT COALESCE(SUM(points),0) FROM green_point_awards WHERE user_id = 1) AS awarded,
       (SELECT COALESCE(SUM(points_spent),0) FROM reward_redemptions WHERE user_id = 1) AS redeemed,
       (SELECT COALESCE(ROUND(SUM(c.co2e_kg)::numeric,1),0) FROM transactions t
          JOIN carbon_estimates c ON c.transaction_id = t.id
         WHERE t.user_id = 1 AND t.direction='debit'
           AND date_trunc('month', t.created_at) = date_trunc('month', '2026-10-05'::timestamptz)) AS month_kg,
       (SELECT COUNT(*) FROM transactions WHERE user_id = 1) AS txns`
  );
  const r = rows.rows[0];
  console.log("[seed] invariants verified:");
  console.log(`  total balance      ${r.balance} (target ${TARGET_TOTAL_BALANCE})`);
  console.log(`  points awarded     ${r.awarded}`);
  console.log(`  points redeemed    ${r.redeemed}`);
  console.log(`  current-month kg   ${r.month_kg} (target 24.8)`);
  console.log(`  transactions       ${r.txns}`);

  // Monthly trend, so a top-up landing in the wrong month is caught here rather
  // than showing up later as a mysteriously tall bar on the dashboard.
  const trend = await client.query(
    `SELECT to_char(date_trunc('month', t.created_at), 'Mon') AS mon,
            ROUND(SUM(c.co2e_kg)::numeric, 1) AS kg
       FROM transactions t JOIN carbon_estimates c ON c.transaction_id = t.id
      WHERE t.user_id = $1 AND t.direction = 'debit'
        AND t.created_at > date_trunc('month', $2::timestamptz) - interval '4 months'
      GROUP BY 1 ORDER BY MIN(t.created_at)`,
    [primary, ANCHOR]
  );
  console.log(`  monthly trend      ${trend.rows.map((x) => `${x.mon} ${x.kg}`).join("  ")}`);
  Object.assign(stats, r);
}

/**
 * Insert a transaction plus its carbon estimate and green-point award.
 *
 * Does not touch balances: those are recomputed from the ledger afterwards, which
 * keeps the insertion order irrelevant.
 */
async function insertTransaction({ client, accountId, userId, direction, amountPaise, category, merchant, at, dueAt = null }) {
  const { rows } = await client.query(
    `INSERT INTO transactions (account_id, user_id, direction, amount, category, merchant, created_at, due_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [accountId, userId, direction, amountPaise, category, merchant, at, dueAt]
  );
  const transactionId = rows[0].id;

  if (direction !== "debit") return transactionId;

  const factor = FACTORS[category] ?? 0;
  const co2e = (amountPaise / 100 / 100) * factor;
  await client.query(
    `INSERT INTO carbon_estimates (transaction_id, category, factor_kg_per_100rupees, co2e_kg, source)
     VALUES ($1,$2,$3,$4,'static')
     ON CONFLICT (transaction_id) DO UPDATE SET co2e_kg = EXCLUDED.co2e_kg`,
    [transactionId, category, factor, co2e]
  );

  const rate = GREEN_POINTS[category] ?? 0;
  if (rate > 0) {
    const points = Math.floor(amountPaise / 10_000) * rate;
    if (points > 0) {
      await client.query(
        `INSERT INTO green_point_awards (user_id, transaction_id, points, reason) VALUES ($1,$2,$3,$4)
         ON CONFLICT (transaction_id) DO NOTHING`,
        [userId, transactionId, points, `${category} purchase`]
      );
    }
  }
  return transactionId;
}

main();