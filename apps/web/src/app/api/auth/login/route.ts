import "server-only";
import { rateLimit, RATE_LIMITS, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { fieldErrors, loginWithMethodSchema } from "@/lib/validation";
import { signInWithPassword, signInWithOtp } from "@/lib/auth/service";
import { ok, fail, handleRoute } from "@/lib/api";

/**
 * Sign-in.
 *
 * Two methods, chosen by the caller:
 *
 *   password  - the standard path. Always runs a hash comparison, even for an
 *               unknown number, so response time does not reveal whether an
 *               account exists.
 *   otp       - mobile-first path for a user who has never set a password.
 *
 * Rate limited per IP, and per phone for the OTP method (which is the expensive
 * one to let run).
 */

export const POST = handleRoute(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = loginWithMethodSchema.safeParse(body);

  if (!parsed.success) {
    return fail(
      422,
      "invalid_request",
      "Enter your phone number and password",
      fieldErrors(parsed.error),
    );
  }

  const { phone, password, method, otpCode, locale } = parsed.data;
  const ip = clientIp(request.headers);

  const limits = await Promise.all([
    rateLimit(`signin:ip:${ip}`, RATE_LIMITS.signIn),
    ...(method === "otp" ? [rateLimit(`signin:phone:${phone}`, RATE_LIMITS.signIn)] : []),
  ]);

  const blocked = limits.find((limit) => !limit.allowed);
  if (blocked) {
    return ok(
      {
        ok: false,
        reason: "rate_limited",
        retryAfterSeconds: blocked.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(blocked),
          "Retry-After": String(blocked.retryAfterSeconds),
        },
      },
    );
  }

  if (method === "otp") {
    if (!otpCode) {
      return fail(422, "invalid_request", "Enter the 6-digit code");
    }

    const result = await signInWithOtp({ phone, otpCode, locale });
    if (!result.ok) {
      // A vague message, as with the password path.
      return ok({ ok: false, message: result.message }, { status: 401 });
    }

    return ok({ ok: true, userId: result.userId });
  }

  if (!password) {
    return fail(422, "invalid_request", "Enter your password");
  }

  const result = await signInWithPassword({ phone, password });
  if (!result.ok) {
    return ok({ ok: false, message: result.message }, { status: 401 });
  }

  return ok({ ok: true, userId: result.userId });
});
