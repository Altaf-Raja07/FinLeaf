import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { Prisma } from "@/generated/prisma/client";

/**
 * Ledger integration tests.
 *
 * These run against a real Postgres. They exist because the correctness of the
 * money path is not something a mock can establish: what matters is that
 * Postgres row locks actually serialise concurrent debits, that the guarded
 * UPDATE really does refuse an overdraft, and that the ledger and the balance
 * agree afterwards.
 *
 * Enable with a database running:
 *   DATABASE_URL=postgresql://... npm run test:integration
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("ledger posting", () => {
  // The Prisma client is instantiated lazily so a missing database is a skipped
  // suite rather than a failed import.
  let prisma: import("@/generated/prisma/client").PrismaClient;
  let postTransaction: typeof import("@/lib/banking/ledger").postTransaction;
  let transfer: typeof import("@/lib/banking/transfer").transfer;
  let openAccount: typeof import("@/lib/banking/account").openAccount;

  const userIds: string[] = [];

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).prisma;
    postTransaction = (await import("@/lib/banking/ledger")).postTransaction;
    transfer = (await import("@/lib/banking/transfer")).transfer;
    openAccount = (await import("@/lib/banking/account")).openAccount;
  });

  afterAll(async () => {
    // The suite cleans up after itself so it leaves no fabricated rows behind.
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.anomalyFlag.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.transaction.deleteMany({
      where: { OR: [{ fromUserId: { in: userIds } }, { toUserId: { in: userIds } }] },
    });
    await prisma.ledgerEntry.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.account.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(phone: string) {
    const user = await prisma.user.create({
      data: {
        name: "Integration Test",
        phone,
        passwordHash: "not-a-hash",
        village: "Dharwad",
        status: "ACTIVE",
      },
      select: { id: true },
    });
    userIds.push(user.id);
    return user;
  }

  describe("double-entry invariant", () => {
    it("credits minus debits equals the account balance", async () => {
      const user = await makeUser("+91tech0000001");
      const account = await openAccount(user.id);
      const ref = `itest-deposit-${Date.now()}`;

      await postTransaction({
        reference: ref,
        type: "DEPOSIT",
        category: "SALARY",
        amount: "1000",
        toAccountId: account.id,
        toUserId: user.id,
      });

      const [balance, entries] = await Promise.all([
        prisma.account.findUniqueOrThrow({ where: { id: account.id } }),
        prisma.ledgerEntry.findMany({ where: { accountId: account.id } }),
      ]);

      const debits = entries
        .filter((e) => e.direction === "DEBIT")
        .reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));
      const credits = entries
        .filter((e) => e.direction === "CREDIT")
        .reduce((sum, e) => sum.plus(e.amount), new Prisma.Decimal(0));

      expect(Number(credits.minus(debits))).toBe(Number(balance.balance));
      expect(Number(entries[0].balanceAfter)).toBe(Number(balance.balance));
    });

    it("records a debit and a credit for a transfer, and they match", async () => {
      const [senderUser, receiverUser] = await Promise.all([
        makeUser("+91tech0000002"),
        makeUser("+91tech0000003"),
      ]);
      const [sender, receiver] = await Promise.all([
        openAccount(senderUser.id),
        openAccount(receiverUser.id),
      ]);

      await postTransaction({
        reference: `itest-funds-${Date.now()}`,
        type: "DEPOSIT",
        category: "SALARY",
        amount: "2000",
        toAccountId: sender.id,
        toUserId: senderUser.id,
      });

      const ref = `itest-xfer-${Date.now()}`;
      await transfer({
        fromUserId: senderUser.id,
        fromAccountId: sender.id,
        to: receiver.number,
        amount: "749.25",
        reference: ref,
      });

      const [senderBalance, receiverBalance, debitEntries, creditEntries] =
        await Promise.all([
          prisma.account.findUniqueOrThrow({ where: { id: sender.id } }),
          prisma.account.findUniqueOrThrow({ where: { id: receiver.id } }),
          prisma.ledgerEntry.findMany({
            where: { accountId: sender.id, direction: "DEBIT" },
          }),
          prisma.ledgerEntry.findMany({
            where: { accountId: receiver.id, direction: "CREDIT" },
          }),
        ]);

      // Both sides of the double entry record the same amount, and each account
      // ends up with exactly what the postings imply.
      expect(Number(senderBalance.balance)).toBe(2000 - 749.25);
      expect(Number(receiverBalance.balance)).toBe(749.25);
      expect(debitEntries).toHaveLength(1);
      expect(creditEntries).toHaveLength(1);
      expect(Number(debitEntries[0].amount)).toBe(749.25);
      expect(Number(creditEntries[0].amount)).toBe(749.25);
    });
  });

  describe("overdraft guard", () => {
    it("refuses a transfer that would take the balance negative", async () => {
      const [senderUser, receiverUser] = await Promise.all([
        makeUser("+91tech0000004"),
        makeUser("+91tech0000005"),
      ]);
      const [sender, receiver] = await Promise.all([
        openAccount(senderUser.id),
        openAccount(receiverUser.id),
      ]);

      await postTransaction({
        reference: `itest-small-${Date.now()}`,
        type: "DEPOSIT",
        category: "SALARY",
        amount: "100",
        toAccountId: sender.id,
        toUserId: senderUser.id,
      });

      await expect(
        transfer({
          fromUserId: senderUser.id,
          fromAccountId: sender.id,
          to: receiver.number,
          amount: "100.01",
          reference: `itest-overdraft-${Date.now()}`,
        }),
      ).rejects.toThrow(/insufficient/i);

      const balance = await prisma.account.findUniqueOrThrow({ where: { id: sender.id } });
      expect(Number(balance.balance)).toBe(100);
    });

    it("allows a transfer that drains the balance to exactly zero", async () => {
      const [senderUser, receiverUser] = await Promise.all([
        makeUser("+91tech0000006"),
        makeUser("+91tech0000007"),
      ]);
      const [sender, receiver] = await Promise.all([
        openAccount(senderUser.id),
        openAccount(receiverUser.id),
      ]);

      await postTransaction({
        reference: `itest-exact-${Date.now()}`,
        type: "DEPOSIT",
        category: "SALARY",
        amount: "50",
        toAccountId: sender.id,
        toUserId: senderUser.id,
      });

      await transfer({
        fromUserId: senderUser.id,
        fromAccountId: sender.id,
        to: receiver.number,
        amount: "50",
        reference: `itest-drain-${Date.now()}`,
      });

      const balance = await prisma.account.findUniqueOrThrow({ where: { id: sender.id } });
      expect(Number(balance.balance)).toBe(0);
    });
  });

  describe("idempotency", () => {
    it("rejects a replayed reference rather than moving money twice", async () => {
      const [senderUser, receiverUser] = await Promise.all([
        makeUser("+91tech0000008"),
        makeUser("+91tech0000009"),
      ]);
      const [sender, receiver] = await Promise.all([
        openAccount(senderUser.id),
        openAccount(receiverUser.id),
      ]);

      await postTransaction({
        reference: `itest-idem-funds-${Date.now()}`,
        type: "DEPOSIT",
        category: "SALARY",
        amount: "500",
        toAccountId: sender.id,
        toUserId: senderUser.id,
      });

      const reference = `itest-replay-${Date.now()}`;

      const attempt = () =>
        transfer({
          fromUserId: senderUser.id,
          fromAccountId: sender.id,
          to: receiver.number,
          amount: "100",
          reference,
        });

      await attempt();
      await expect(attempt()).rejects.toThrow(/already been used/i);

      const balance = await prisma.account.findUniqueOrThrow({ where: { id: sender.id } });
      expect(Number(balance.balance)).toBe(400);
    });
  });

  describe("concurrency", () => {
    it("serialises simultaneous debits so the balance cannot go negative", async () => {
      // The real value of this test: the guarded UPDATE is only safe if Postgres
      // takes the row lock for the duration of the statement. Firing five debits
      // at once checks that assumption rather than trusting it.
      const [senderUser, receiverUser] = await Promise.all([
        makeUser("+91tech0000010"),
        makeUser("+91tech0000011"),
      ]);
      const [sender, receiver] = await Promise.all([
        openAccount(senderUser.id),
        openAccount(receiverUser.id),
      ]);

      await postTransaction({
        reference: `itest-conc-funds-${Date.now()}`,
        type: "DEPOSIT",
        category: "SALARY",
        amount: "500",
        toAccountId: sender.id,
        toUserId: senderUser.id,
      });

      // Five attempts to spend 200 each; only two can succeed.
      const attempts = [1, 2, 3, 4, 5].map((n) =>
        transfer({
          fromUserId: senderUser.id,
          fromAccountId: sender.id,
          to: receiver.number,
          amount: "200",
          reference: `itest-conc-${Date.now()}-${n}`,
        }).then(
          () => "ok" as const,
          () => "refused" as const,
        ),
      );

      const outcomes = await Promise.all(attempts);
      const succeeded = outcomes.filter((o) => o === "ok").length;

      expect(succeeded).toBe(2);

      const balance = await prisma.account.findUniqueOrThrow({ where: { id: sender.id } });
      expect(Number(balance.balance)).toBe(100);
    });
  });
});
