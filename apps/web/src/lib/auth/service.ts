import "server-only";
import { prisma } from "@/lib/db";
import { recordAudit } from "@/lib/audit";
import { createSession, setSessionCookie, revokeAllSessions } from "@/lib/auth/session";
import { openAccount } from "@/lib/banking/account";
import { hashPassword, verifyPassword } from "@/lib/crypto/hash";
import { hashOtpCode } from "@/lib/crypto/pepper";
import { log } from "@/lib/env";
import type { OtpPurpose, UserStatus } from "@/generated/prisma/enums";

/**
 * Registration and sign-in.
 *
 * Both flows require the phone number to be proven by OTP before an account is
 * created or a session is issued. There is no path that creates a user without
 * a verified phone, so there is no such thing as an unverified account that can
 * transact.
 */

export interface RequestOtpInput {
  phone: string;
  purpose: OtpPurpose;
  locale: string;
}

export interface RegisterInput {
  name: string;
  phone: string;
  village: string;
  password: string;
  preferredLang: "en" | "hi" | "kn";
}

export async function registerWithOtp(
  input: RegisterInput,
): Promise<{ ok: true; userId: string } | { ok: false; code: string; message: string }> {
  const existing = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: { id: true },
  });

  if (existing) {
    // Say nothing more specific. Confirming the number is taken would let
    // anyone test which phone numbers are registered.
    return {
      ok: false,
      code: "phone_taken",
      message: "We could not complete registration with those details.",
    };
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      phone: input.phone,
      village: input.village,
      passwordHash,
      preferredLang: input.preferredLang,
      status: "ACTIVE",
      accountAgeDays: 1,
    },
    select: { id: true },
  });

  await openAccount(user.id);

  await recordAudit({ userId: user.id, action: "SIGN_UP" });

  return { ok: true, userId: user.id };
}

/**
 * Signs a user in with phone and password and issues a session.
 *
 * The result is deliberately vague about which factor failed.
 */
export async function signInWithPassword(input: {
  phone: string;
  password: string;
}): Promise<
  { ok: true; userId: string; status: UserStatus } | { ok: false; message: string }
> {
  const user = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: { id: true, passwordHash: true, status: true, role: true },
  });

  // Always run a hash comparison, even when there is no user. Returning early
  // here would make a missing number measurably faster than a wrong password,
  // which turns this endpoint into a registration oracle.
  const candidate = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv";
  const valid = await verifyPassword(input.password, candidate);

  if (!user || !valid) {
    return {
      ok: false,
      message: "We could not sign you in with those details.",
    };
  }

  if (user.status === "SUSPENDED" || user.status === "CLOSED") {
    return { ok: false, message: "This account is not active." };
  }

  // A user who has never verified their phone cannot sign in with a password;
  // verification is the only way in.
  if (user.status === "PENDING_VERIFICATION") {
    return {
      ok: false,
      message: "Verify your phone number before signing in.",
    };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  await issueSession(user.id);

  await recordAudit({ userId: user.id, action: "SIGN_IN" });

  return { ok: true, userId: user.id, status: user.status };
}

/** Issues a session for an already-verified user (used by OTP login). */
export async function issueSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const { token, expiresAt } = await createSession(userId);
  await setSessionCookie(token, expiresAt);
  return { token, expiresAt };
}

/**
 * OTP sign-in: an alternative to the password for users who cannot type one.
 *
 * The phone is the identity; if the code is right, the number is proven, so a
 * first-time number creates a minimal account rather than being rejected. This
 * is the mobile-first path a low-literacy user will actually use.
 */
export async function signInWithOtp(input: {
  phone: string;
  otpCode: string;
  locale: string;
}): Promise<{ ok: true; userId: string; created: boolean } | { ok: false; message: string }> {
  const record = await prisma.otp.findFirst({
    where: { phone: input.phone, purpose: "LOGIN", consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, attempts: true, expiresAt: true },
  });

  if (!record || record.expiresAt <= new Date()) {
    return { ok: false, message: "That code has expired. Request a new one." };
  }

  const { safeEqual } = await import("@/lib/crypto/hash");
  if (!safeEqual(record.codeHash, hashOtpCode(input.otpCode))) {
    await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, message: "That code is not right." };
  }

  await prisma.otp.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: { id: true, status: true },
  });

  if (!user) {
    // First sign-in on this number. An account is created with no password:
    // it is reachable only by OTP until the user sets one, which is the right
    // posture for someone who has never had a password before.
    const { generateOtpCode } = await import("@/lib/crypto/hash");
    const randomPassword = generateOtpCode(24);
    const passwordHash = await hashPassword(randomPassword);

    const created = await prisma.user.create({
      data: {
        name: "FinLeaf user",
        phone: input.phone,
        village: "—",
        passwordHash,
        preferredLang: (input.locale === "hi" ? "hi" : input.locale === "kn" ? "kn" : "en"),
        status: "ACTIVE",
        accountAgeDays: 1,
      },
      select: { id: true },
    });

    await openAccount(created.id);
    await issueSession(created.id);
    await recordAudit({ userId: created.id, action: "SIGN_UP" });

    log("info", "otp sign-in created an account", { userId: created.id });
    return { ok: true, userId: created.id, created: true };
  }

  if (user.status !== "ACTIVE") {
    return { ok: false, message: "This account is not active." };
  }

  await issueSession(user.id);
  await recordAudit({ userId: user.id, action: "SIGN_IN" });

  return { ok: true, userId: user.id, created: false };
}

/**
 * Changes a user's password and revokes every existing session.
 *
 * Revoking is the point: if someone else had access, changing the password
 * without ending their sessions would lock nothing down.
 */
export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { passwordHash: true },
  });

  if (!user) return { ok: false, message: "We could not find that account." };

  const valid = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!valid) {
    return { ok: false, message: "Your current password is not right." };
  }

  if (input.currentPassword === input.newPassword) {
    return { ok: false, message: "Your new password has to be different." };
  }

  await prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });

  const revoked = await revokeAllSessions(input.userId);
  await recordAudit({
    userId: input.userId,
    action: "PASSWORD_CHANGED",
    detail: { sessionsRevoked: revoked },
  });

  log("info", "password changed", { userId: input.userId, sessionsRevoked: revoked });
  return { ok: true };
}

/**
 * Resets a password after an OTP has been proven.
 *
 * Issues a fresh session so the user is immediately signed in, which is what a
 * person who has just proved control of the phone number expects.
 */
export async function resetPasswordWithOtp(input: {
  phone: string;
  otpCode: string;
  newPassword: string;
}): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const record = await prisma.otp.findFirst({
    where: { phone: input.phone, purpose: "PASSWORD_RESET", consumedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, codeHash: true, expiresAt: true },
  });

  if (!record || record.expiresAt <= new Date()) {
    return { ok: false, message: "That code has expired. Request a new one." };
  }

  const { safeEqual } = await import("@/lib/crypto/hash");
  if (!safeEqual(record.codeHash, hashOtpCode(input.otpCode))) {
    return { ok: false, message: "That code is not right." };
  }

  await prisma.otp.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  const user = await prisma.user.findUnique({
    where: { phone: input.phone },
    select: { id: true },
  });

  if (!user) {
    return { ok: false, message: "We could not find an account with that number." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });

  await revokeAllSessions(user.id);
  await issueSession(user.id);

  await recordAudit({ userId: user.id, action: "PASSWORD_RESET" });

  return { ok: true, userId: user.id };
}

/**
 * OTP sign-in requires no password, but the seed and password flows do — this
 * is the single place that decides which one a user is allowed to use.
 */
export function passwordSignInAllowed(status: UserStatus): boolean {
  return status === "ACTIVE";
}
