"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  requestOtp as issueOtp,
  verifyOtp as redeemOtp,
} from "@/lib/auth/otp";
import { signInWithPassword, signInWithOtp } from "@/lib/auth/service";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * Server Actions for the auth forms.
 *
 * These are the mutation surface the client components call. They deliberately
 * do not re-check a session: sign-in and registration are the endpoints that run
 * *before* there is a session. Every one of them is rate limited, because they
 * are the endpoints an attacker would target.
 */

/** Action state the forms render. */
export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

const RATE_LIMIT_MESSAGE =
  "Too many attempts. Wait a minute and try again.";

async function requestClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

/** Asks for an OTP. Called by the OTP sign-in form before verification. */
export async function requestOtp(
  phone: string,
  purpose: "REGISTRATION" | "LOGIN" | "PASSWORD_RESET" | "PHONE_CHANGE",
  locale: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const ip = await requestClientIp();
  const limited = await rateLimit(`signin:ip:${ip}`, RATE_LIMITS.signIn);

  if (!limited.allowed) {
    return { ok: false, message: RATE_LIMIT_MESSAGE };
  }

  const result = await issueOtp({ phone, purpose, locale });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "cooldown"
          ? `Wait ${result.retryAfterSeconds}s before asking for another code.`
          : "We could not send a code just now. Please try again.",
    };
  }

  return { ok: true };
}

export async function verifyOtpCode(
  phone: string,
  purpose: "REGISTRATION" | "LOGIN" | "PASSWORD_RESET" | "PHONE_CHANGE",
  code: string,
  locale: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await redeemOtp({ phone, purpose, code });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "locked"
          ? "Too many attempts on that code. Request a new one."
          : result.reason === "invalid"
            ? "That code is not right."
            : "That code expired. Request a new one.",
    };
  }

  if (purpose === "LOGIN") {
    const signedIn = await signInWithOtp({ phone, otpCode: code, locale });
    if (!signedIn.ok) return { ok: false, message: signedIn.message };
    revalidatePath("/dashboard", "layout");
    redirect("/dashboard");
  }

  return { ok: true };
}

/** Password sign-in. */
export async function passwordLogin(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!phone || !password) {
    return { error: "Enter your phone number and password." };
  }

  const ip = await requestClientIp();
  const limited = await rateLimit(`signin:ip:${ip}`, RATE_LIMITS.signIn);
  if (!limited.allowed) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const result = await signInWithPassword({ phone, password });

  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

/** OTP sign-in. Reuses the code the user already requested. */
export async function otpLogin(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const otpCode = String(formData.get("otpCode") ?? "").trim();
  const locale = String(formData.get("locale") ?? "en");

  if (!phone || !otpCode) {
    return { error: "Enter your phone number and the 6-digit code." };
  }

  const ip = await requestClientIp();
  const limited = await rateLimit(`signin:ip:${ip}`, RATE_LIMITS.signIn);
  if (!limited.allowed) {
    return { error: RATE_LIMIT_MESSAGE };
  }

  const result = await signInWithOtp({ phone, otpCode, locale });

  if (!result.ok) {
    return { error: result.message };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
