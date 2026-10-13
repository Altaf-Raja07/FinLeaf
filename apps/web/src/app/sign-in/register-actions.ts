"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { verifyOtp } from "@/lib/auth/otp";
import { registerWithOtp, issueSession } from "@/lib/auth/service";
import { rateLimit, RATE_LIMITS, clientIp } from "@/lib/rate-limit";
import { fieldErrors, registerSchema } from "@/lib/validation";

/**
 * Registration Server Action.
 *
 * The OTP is redeemed here rather than before, so the whole form is a single
 * submission: the user's details and the code they were sent arrive together,
 * and there is no window in which an account half-exists.
 *
 * A failure message never distinguishes "that number is already registered"
 * from "the code was wrong", because confirming the former would let anyone
 * test which phone numbers hold accounts.
 */

export interface RegisterState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

export async function registerUser(
  _prev: RegisterState,
  formData: FormData,
): Promise<RegisterState> {
  const raw = Object.fromEntries(
    [...formData.entries()].filter(
      ([key]) => !key.startsWith("$ACTION_") && key !== "locale",
    ),
  );

  const parsed = registerSchema.safeParse({
    ...raw,
    locale: String(formData.get("locale") ?? "en"),
  });

  if (!parsed.success) {
    return {
      error: "Check the highlighted fields.",
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { name, phone, village, password, preferredLang, otpCode, locale } =
    parsed.data;

  const ip = clientIp(await headers());
  const limited = await rateLimit(`signup:ip:${ip}`, RATE_LIMITS.signUp);
  if (!limited.allowed) {
    return { error: "Too many attempts. Wait a while and try again." };
  }

  // The phone number is proven before an account is created, so an unverified
  // account can never exist.
  const verified = await verifyOtp({ phone, purpose: "REGISTRATION", code: otpCode });

  if (!verified.ok) {
    return {
      error:
        verified.reason === "locked"
          ? "Too many attempts on that code. Request a new one."
          : "That code is not right or has expired.",
    };
  }

  const created = await registerWithOtp({
    name,
    phone,
    village,
    password,
    preferredLang,
  });

  if (!created.ok) {
    return { error: created.message };
  }

  await issueSession(created.userId);

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
