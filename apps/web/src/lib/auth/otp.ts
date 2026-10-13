import "server-only";
import { prisma } from "@/lib/db";
import { generateOtpCode, hashOtpCode, safeEqual } from "@/lib/crypto";
import { deliverOtp } from "@/lib/sms";
import { log } from "@/lib/env";
import type { OtpPurpose } from "@/generated/prisma/enums";

/**
 * OTP lifecycle: issue, verify, and consume.
 *
 * The code is stored only as an HMAC digest, is single-use (`consumedAt`), and
 * expires quickly. Every failure path returns a deliberately vague result so an
 * attacker cannot distinguish "no such phone" from "wrong code" and use the
 * endpoint to enumerate registered numbers.
 */

export const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;

/** How long an unverified phone number is blocked from re-requesting a code. */
const RESEND_COOLDOWN_SECONDS = 30;

export type OtpRequestResult =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: "cooldown" | "delivery"; retryAfterSeconds?: number };

export async function requestOtp(input: {
  phone: string;
  purpose: OtpPurpose;
  locale: string;
}): Promise<OtpRequestResult> {
  const now = new Date();

  // Per-phone cooldown: without it the SMS endpoint is an amplifier for
  // operator-cost abuse and for SMS-flooding the handset.
  const recent = await prisma.otp.findFirst({
    where: { phone: input.phone, purpose: input.purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (recent) {
    const elapsed = (now.getTime() - recent.createdAt.getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return {
        ok: false,
        reason: "cooldown",
        retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
      };
    }
  }

  const code = generateOtpCode();
  const expiresAt = new Date(now.getTime() + OTP_TTL_MINUTES * 60 * 1000);

  // Invalidate any codes still outstanding for this phone+purpose so only the
  // newest one can be redeemed.
  await prisma.otp.updateMany({
    where: { phone: input.phone, purpose: input.purpose, consumedAt: null },
    data: { consumedAt: now },
  });

  try {
    const result = await deliverOtp({
      phone: input.phone,
      code,
      purpose: input.purpose,
      ttlMinutes: OTP_TTL_MINUTES,
      locale: input.locale,
    });

    log("info", "otp issued", { purpose: input.purpose, provider: result.provider });

    await prisma.otp.create({
      data: {
        phone: input.phone,
        codeHash: hashOtpCode(code),
        purpose: input.purpose,
        expiresAt,
      },
    });

    return { ok: true, expiresAt };
  } catch {
    return { ok: false, reason: "delivery" };
  }
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "locked" };

/**
 * Redeems an OTP.
 *
 * The newest unconsumed, unexpired row for the phone+purpose is selected and
 * compared in constant time. Attempt count is tracked on that row; once it
 * reaches {@link MAX_VERIFY_ATTEMPTS} the code is burned so a leaked code
 * cannot be brute-forced within its 10-minute window (1e6 candidates is not
 * enough to matter against 5 attempts).
 */
export async function verifyOtp(input: {
  phone: string;
  purpose: OtpPurpose;
  code: string;
}): Promise<OtpVerifyResult> {
  const record = await prisma.otp.findFirst({
    where: {
      phone: input.phone,
      purpose: input.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.expiresAt <= new Date()) {
    return { ok: false, reason: "invalid" };
  }

  if (record.attempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.otp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
    return { ok: false, reason: "locked" };
  }

  const matches = safeEqual(record.codeHash, hashOtpCode(input.code.trim()));

  if (!matches) {
    const updated = await prisma.otp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
      select: { attempts: true },
    });

    return updated.attempts >= MAX_VERIFY_ATTEMPTS
      ? { ok: false, reason: "locked" }
      : { ok: false, reason: "invalid" };
  }

  await prisma.otp.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}

/**
 * Housekeeping for the scheduled maintenance job: drops codes that expired
 * more than a day ago, and redeemed codes past their retention window.
 */
export async function pruneExpiredOtps(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.otp.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: cutoff } }, { consumedAt: { lt: cutoff } }],
    },
  });
  return result.count;
}
