"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { registerWithOtp, issueSession } from "@/lib/auth/service";
import { rateLimit, RATE_LIMITS, clientIp } from "@/lib/rate-limit";
import { fieldErrors, registerSchema } from "@/lib/validation";
import { parseLocale, translate } from "@/lib/i18n";

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

  // The hidden locale field the form carries doubles as the language the
  // failure messages are shown in; `lib/auth` returns codes and stays
  // locale-agnostic.
  const locale = parseLocale(String(formData.get("locale") ?? "en"));

  const parsed = registerSchema.safeParse({
    ...raw,
    locale: String(formData.get("locale") ?? "en"),
  });

  if (!parsed.success) {
    return {
      error: translate(locale, "auth.checkFields"),
      fieldErrors: fieldErrors(parsed.error),
    };
  }

  const { name, phone, village, password, preferredLang } = parsed.data;

  const ip = clientIp(await headers());
  const limited = await rateLimit(`signup:ip:${ip}`, RATE_LIMITS.signUp);
  if (!limited.allowed) {
    return {
      error: translate(locale, "error.rateLimited", {
        seconds: limited.retryAfterSeconds,
      }),
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
    return {
      error:
        created.code === "phone_taken"
          ? translate(locale, "auth.registrationFailed")
          : translate(locale, "error.generic"),
    };
  }

  await issueSession(created.userId);

  revalidatePath("/dashboard", "layout");
  redirect("/dashboard");
}
