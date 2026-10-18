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
import { parseLocale, translate, type Locale } from "@/lib/i18n";
import { requestLocale } from "@/lib/locale";

/**
 * Server Actions for the auth forms.
 *
 * These are the mutation surface the client components call. They deliberately
 * do not re-check a session: sign-in and registration are the endpoints that run
 * *before* there is a session. Every one of them is rate limited, because they
 * are the endpoints an attacker would target.
 *
 * The failure messages are assembled here rather than inside `lib/auth`, which
 * returns machine-readable codes and stays locale-agnostic. The action owns
 * wording, the library owns behaviour, and a new failure code is a compile
 * error until it has words in every locale below.
 */

/** Action state the forms render. */
export interface AuthActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  ok?: boolean;
}

function signInFailureMessage(
  locale: Locale,
  code: "bad_credentials" | "inactive" | "unverified_phone",
): string {
  switch (code) {
    case "bad_credentials":
      return translate(locale, "auth.noSuchAccount");
    case "inactive":
      return translate(locale, "auth.accountLocked");
    case "unverified_phone":
      return translate(locale, "auth.verifyPhone");
  }
}

function otpFailureMessage(
  locale: Locale,
  code: "expired" | "wrong_code" | "inactive",
): string {
  switch (code) {
    case "expired":
      return translate(locale, "auth.codeExpired");
    case "wrong_code":
      return translate(locale, "auth.wrongCodeSimple");
    case "inactive":
      return translate(locale, "auth.accountLocked");
  }
}

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

  // The caller's locale drives both the SMS language and the message shown,
  // so the number and the words come from the same preference.
  const lang = parseLocale(locale);

  if (!limited.allowed) {
    return {
      ok: false,
      message: translate(lang, "error.rateLimitedSignIn", {
        seconds: limited.retryAfterSeconds,
      }),
    };
  }

  const result = await issueOtp({ phone, purpose, locale });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "cooldown"
          ? translate(lang, "auth.cooldown", {
              seconds: result.retryAfterSeconds ?? 30,
            })
          : translate(lang, "auth.couldNotSend"),
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
  const lang = parseLocale(locale);
  const result = await redeemOtp({ phone, purpose, code });

  if (!result.ok) {
    return {
      ok: false,
      message:
        result.reason === "locked"
          ? translate(lang, "auth.codeLocked")
          : translate(lang, "auth.wrongCodeSimple"),
    };
  }

  if (purpose === "LOGIN") {
    const signedIn = await signInWithOtp({ phone, otpCode: code, locale });
    if (!signedIn.ok) {
      return { ok: false, message: otpFailureMessage(lang, signedIn.code) };
    }
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
  const locale = await requestLocale();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!phone || !password) {
    return { error: translate(locale, "auth.enterPhonePassword") };
  }

  const ip = await requestClientIp();
  const limited = await rateLimit(`signin:ip:${ip}`, RATE_LIMITS.signIn);
  if (!limited.allowed) {
    return {
      error: translate(locale, "error.rateLimitedSignIn", {
        seconds: limited.retryAfterSeconds,
      }),
    };
  }

  const result = await signInWithPassword({ phone, password });

  if (!result.ok) {
    return { error: signInFailureMessage(locale, result.code) };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}

/** OTP sign-in. Reuses the code the user already requested. */
export async function otpLogin(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  // The active UI locale owns both the SMS language and the wording shown
  // here, so a failure message is never more English than the screen.
  const locale = await requestLocale();
  const phone = String(formData.get("phone") ?? "").trim();
  const otpCode = String(formData.get("otpCode") ?? "").trim();

  if (!phone || !otpCode) {
    return { error: translate(locale, "auth.enterPhoneAndCode") };
  }

  const ip = await requestClientIp();
  const limited = await rateLimit(`signin:ip:${ip}`, RATE_LIMITS.signIn);
  if (!limited.allowed) {
    return {
      error: translate(locale, "error.rateLimitedSignIn", {
        seconds: limited.retryAfterSeconds,
      }),
    };
  }

  const result = await signInWithOtp({ phone, otpCode, locale });

  if (!result.ok) {
    return { error: otpFailureMessage(locale, result.code) };
  }

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
