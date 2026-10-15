import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";

/**
 * Money-path smoke test.
 *
 * Runs against the live database and exercises the posting engine the way the
 * application does: deposit, transfer, and the assertions that would catch an
 * overdraft, a lost ledger entry, or a balance that drifts from its own trail.
 *
 * Run with:  npx tsx scripts/smoke-money.ts
 * It creates its own account and cleans up after itself.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    max: 4,
  }),
});

let failures = 0;

/**
 * Account balance as a plain number.
 *
 * Compared numerically rather than by string because Prisma's Decimal
 * normalises `"5000.00"` to `"5000"` — the value is identical, and a string
 * assertion on the trailing zeros would fail for a reason that is not a bug.
 */
function bal(account: { balance: Prisma.Decimal } | null): number {
  if (!account) return Number.NaN;
  return Number(account.balance);
}

function check(name: string, pass: boolean, detail: string | number = "") {
  if (!pass) failures += 1;
  const detailText = typeof detail === "number" ? String(detail) : detail;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detailText ? "  — " + detailText : ""}`);
}

async function main() {
  const { postTransaction } = await import("../src/lib/banking/ledger");
  const { openAccount } = await import("../src/lib/banking/account");
  const { transfer } = await import("../src/lib/banking/transfer");
  // Two fresh accounts. No seeded demo data — these are made here.
  const sender = await prisma.user.create({
    data: {
      name: "Money Path Sender",
      phone: "+919811100001",
      passwordHash: "not-a-real-hash",
      village: "Dharwad",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  const receiver = await prisma.user.create({
    data: {
      name: "Money Path Receiver",
      phone: "+919811100002",
      passwordHash: "not-a-real-hash",
      village: "Dharwad",
      status: "ACTIVE",
    },
    select: { id: true },
  });

  const senderAccount = await openAccount(sender.id);
  const receiverAccount = await openAccount(receiver.id);

  // --- 1. Deposit cash ---------------------------------------------------
  await postTransaction({
    reference: `smoke-deposit-${Date.now()}`,
    type: "DEPOSIT",
    category: "SALARY",
    amount: "5000.00",
    toAccountId: senderAccount.id,
    toUserId: sender.id,
  });

  const afterDeposit = await prisma.account.findUnique({
    where: { id: senderAccount.id },
    select: { balance: true },
  });
  check(
    "deposit credits the account",
    bal(afterDeposit) === 5000,
    String(bal(afterDeposit)),
  );

  // --- 2. Transfer -------------------------------------------------------
  const result = await transfer({
    fromUserId: sender.id,
    fromAccountId: senderAccount.id,
    to: receiverAccount.number,
    amount: "1500.50",
    note: "smoke test",
    category: "TRANSFER",
    reference: `smoke-transfer-${Date.now()}`,
  });

  const [senderAfter, receiverAfter] = await Promise.all([
    prisma.account.findUnique({ where: { id: senderAccount.id }, select: { balance: true } }),
    prisma.account.findUnique({ where: { id: receiverAccount.id }, select: { balance: true } }),
  ]);

  check("transfer debits the sender", bal(senderAfter) === 3499.5, bal(senderAfter));
  check("transfer credits the recipient", bal(receiverAfter) === 1500.5, bal(receiverAfter));
  check("transfer returns the recipient name", result.recipientName === "Money Path Receiver", result.recipientName);

  // --- 3. The ledger balances --------------------------------------------
  const entries = await prisma.ledgerEntry.findMany({
    where: { accountId: senderAccount.id },
    select: { direction: true, amount: true, balanceAfter: true },
    orderBy: { createdAt: "asc" },
  });

  check("sender has two ledger entries", entries.length === 2, String(entries.length));

  const debits = entries
    .filter((e) => e.direction === "DEBIT")
    .reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));
  const credits = entries
    .filter((e) => e.direction === "CREDIT")
    .reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));
  const net = credits.minus(debits);

  check(
    "balance equals credits minus debits in the ledger",
    Number(net) === bal(senderAfter),
    `ledger ${net.toString()} vs balance ${senderAfter?.balance}`,
  );

  const lastEntry = entries[entries.length - 1];
  check(
    "the last entry's balanceAfter matches the account balance",
    Number(lastEntry.balanceAfter) === bal(senderAfter),
    `${lastEntry.balanceAfter} vs ${senderAfter?.balance}`,
  );

  // --- 4. Overdraft is refused ------------------------------------------
  let refused = false;
  try {
    await transfer({
      fromUserId: sender.id,
      fromAccountId: senderAccount.id,
      to: receiverAccount.number,
      amount: "999999999",
      category: "TRANSFER",
      reference: `smoke-overdraft-${Date.now()}-A`,
    });
  } catch (error) {
    refused = error instanceof Error && error.name === "InsufficientFundsError";
  }
  check("an overdraft transfer is refused", refused);

  const balanceUnchanged = await prisma.account.findUnique({
    where: { id: senderAccount.id },
    select: { balance: true },
  });
  check("the refused transfer left the balance alone", bal(balanceUnchanged) === 3499.5, bal(balanceUnchanged));

  // --- 5. Idempotency ----------------------------------------------------
  let duplicateFailed = false;
  // The same reference is submitted twice; the posting engine must reject the
  // second one rather than moving the money again.
  const replayReference = `smoke-replay-${Date.now()}`;
  try {
    await transfer({
      fromUserId: sender.id,
      fromAccountId: senderAccount.id,
      to: receiverAccount.number,
      amount: "100",
      category: "TRANSFER",
      reference: replayReference,
    });
    await transfer({
      fromUserId: sender.id,
      fromAccountId: senderAccount.id,
      to: receiverAccount.number,
      amount: "100",
      category: "TRANSFER",
      reference: replayReference,
    });
  } catch {
    duplicateFailed = true;
  }
  check("a replayed reference is refused", duplicateFailed);

  // Cleanup: the smoke test leaves nothing behind.
  await prisma.auditLog.deleteMany({ where: { userId: { in: [sender.id, receiver.id] } } });
  await prisma.anomalyFlag.deleteMany({ where: { userId: { in: [sender.id, receiver.id] } } });
  await prisma.transaction.deleteMany({ where: { OR: [{ fromUserId: { in: [sender.id] } }, { toUserId: receiver.id }] } });
  await prisma.ledgerEntry.deleteMany({ where: { userId: { in: [sender.id, receiver.id] } } });
  await prisma.account.deleteMany({ where: { userId: { in: [sender.id, receiver.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [sender.id, receiver.id] } } });

  console.log(`\n${failures} failure(s)`);
  await prisma.$disconnect();
  process.exitCode = failures > 0 ? 1 : 0;
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
