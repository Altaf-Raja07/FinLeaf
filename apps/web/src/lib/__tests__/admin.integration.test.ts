import { describe, expect, it, beforeAll, afterAll } from "vitest";

/**
 * Authorisation integration tests for the administration layer.
 *
 * These exist because of a specific class of bug: the admin console hides
 * buttons a non-administrator should not press, but a **server action is a
 * public POST endpoint**. Hiding a button is not access control. The functions
 * in `src/lib/admin` re-read the actor's role from the database precisely so a
 * hand-crafted request fails the same way the UI would. These tests call those
 * functions directly, with the same arguments a hostile request would supply,
 * and require a refusal — and require the database to be unchanged afterwards.
 *
 * Enable with a database running:
 *   DATABASE_URL=postgresql://... npm run test:integration
 */

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("admin authorisation", () => {
  let prisma: import("@/generated/prisma/client").PrismaClient;
  let updateUser: typeof import("@/lib/admin").updateUser;
  let createAgentAsAdmin: typeof import("@/lib/admin").createAgentAsAdmin;
  let deactivateAgentAsAdmin: typeof import("@/lib/admin").deactivateAgentAsAdmin;
  let AuthError: typeof import("@/lib/auth/guard").AuthError;

  const userIds: string[] = [];
  const agentIds: string[] = [];

  beforeAll(async () => {
    prisma = (await import("@/lib/db")).prisma;
    ({ updateUser, createAgentAsAdmin, deactivateAgentAsAdmin } = await import(
      "@/lib/admin"
    ));
    ({ AuthError } = await import("@/lib/auth/guard"));
  });

  afterAll(async () => {
    // The suite cleans up after itself: no fabricated rows survive a run.
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.agent.deleteMany({ where: { id: { in: agentIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });

  async function makeUser(phone: string, role: "USER" | "ADMIN" = "USER") {
    const user = await prisma.user.create({
      data: {
        name: "Authz Integration Test",
        phone,
        passwordHash: "not-a-hash",
        village: "Dharwad",
        status: "ACTIVE",
        role,
      },
      select: { id: true },
    });
    userIds.push(user.id);
    return user;
  }

  describe("updateUser", () => {
    it("refuses a plain user acting as an administrator", async () => {
      const actor = await makeUser("+91authz0000001", "USER");
      const target = await makeUser("+91authz0000002", "USER");

      await expect(
        updateUser({ adminId: actor.id, userId: target.id, status: "SUSPENDED" }),
      ).rejects.toBeInstanceOf(AuthError);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
        select: { status: true },
      });
      expect(after.status).toBe("ACTIVE");

      const audits = await prisma.auditLog.count({ where: { userId: actor.id } });
      expect(audits).toBe(0);
    });

    it("refuses a suspended administrator", async () => {
      const actor = await makeUser("+91authz0000003", "ADMIN");
      await prisma.user.update({
        where: { id: actor.id },
        data: { status: "SUSPENDED" },
      });
      const target = await makeUser("+91authz0000004", "USER");

      await expect(
        updateUser({ adminId: actor.id, userId: target.id, status: "SUSPENDED" }),
      ).rejects.toBeInstanceOf(AuthError);
    });

    it("allows an administrator to suspend another user", async () => {
      const actor = await makeUser("+91authz0000005", "ADMIN");
      const target = await makeUser("+91authz0000006", "USER");

      const result = await updateUser({
        adminId: actor.id,
        userId: target.id,
        status: "SUSPENDED",
      });
      expect(result.ok).toBe(true);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
        select: { status: true },
      });
      expect(after.status).toBe("SUSPENDED");
    });

    it("refuses an administrator changing their own role", async () => {
      const actor = await makeUser("+91authz0000007", "ADMIN");

      const result = await updateUser({
        adminId: actor.id,
        userId: actor.id,
        role: "USER",
      });
      expect(result.ok).toBe(false);

      const after = await prisma.user.findUniqueOrThrow({
        where: { id: actor.id },
        select: { role: true },
      });
      expect(after.role).toBe("ADMIN");
    });
  });

  describe("agent directory", () => {
    const agentInput = {
      name: "Authorisation Test",
      shopName: "Test Kiosk",
      village: "Dharwad",
      phone: "+919876500000",
      latitude: 15.4589,
      longitude: 75.0078,
      openHours: "Mon-Sat 09:00-18:00",
    };

    it("refuses agent creation by a non-administrator", async () => {
      const actor = await makeUser("+91authz0000008", "USER");

      await expect(
        createAgentAsAdmin(actor.id, agentInput),
      ).rejects.toBeInstanceOf(AuthError);

      const count = await prisma.agent.count({
        where: { phone: agentInput.phone },
      });
      expect(count).toBe(0);
    });

    it("lets an administrator add and deactivate an agent, with an audit trail", async () => {
      const actor = await makeUser("+91authz0000009", "ADMIN");

      const agent = await createAgentAsAdmin(actor.id, agentInput);
      agentIds.push(agent.id);
      expect(agent.active).toBe(true);

      await deactivateAgentAsAdmin(actor.id, agent.id);

      const after = await prisma.agent.findUniqueOrThrow({
        where: { id: agent.id },
        select: { active: true },
      });
      expect(after.active).toBe(false);

      const audits = await prisma.auditLog.count({
        where: { userId: actor.id, action: "ADMIN_ACTION" },
      });
      expect(audits).toBeGreaterThanOrEqual(2);
    });

    it("refuses agent deactivation by a non-administrator", async () => {
      const actor = await makeUser("+91authz0000010", "ADMIN");
      const intruder = await makeUser("+91authz0000011", "USER");

      const agent = await createAgentAsAdmin(actor.id, {
        ...agentInput,
        phone: "+919876500001",
      });
      agentIds.push(agent.id);

      await expect(
        deactivateAgentAsAdmin(intruder.id, agent.id),
      ).rejects.toBeInstanceOf(AuthError);

      const after = await prisma.agent.findUniqueOrThrow({
        where: { id: agent.id },
        select: { active: true },
      });
      expect(after.active).toBe(true);
    });
  });
});
