import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { requestPasswordResetSchema, resetPasswordSchema } from "@/lib/validation";
import { requestOtp } from "@/lib/auth/otp";
import { resetPasswordWithOtp } from "@/lib/auth/service";
import { ok, fail, handleRoute } from "@/lib/api";

/**
 * Password reset.
 *
 * Two steps: request a code, then set a new password. The response to the
 * request step is identical whether or not the number is registered, so this
 * endpoint cannot be used to enumerate accounts.
 */

export const POST = handleRoute(async (request: Request) => {
  const body = await request.json().catch(() => null);

  const reset = resetPasswordSchema.safeParse(body);
  if (reset.success) {
    const result = await resetPasswordWithOtp({
      phone: reset.data.phone,
      otpCode: reset.data.otpCode,
      newPassword: reset.data.password,
    });

    if (!result.ok) {
      return ok({ ok: false, message: result.message }, { status: 400 });
    }

    return ok({ ok: true });
  }

  const requestBody = requestPasswordResetSchema.safeParse(body);
  if (!requestBody.success) {
    return fail(422, "invalid_request", "Enter your phone number");
  }

  const limited = await rateLimit(
    `reset:phone:${requestBody.data.phone}`,
    RATE_LIMITS.otpRequest,
  );

  if (!limited.allowed) {
    return ok(
      { ok: false, reason: "rate_limited", retryAfterSeconds: limited.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  // Always a 200, with the same body, so the caller cannot tell whether the
  // number has an account.
  await requestOtp({
    phone: requestBody.data.phone,
    purpose: "PASSWORD_RESET",
    locale: requestBody.data.locale,
  });

  return ok({ ok: true, sent: true });
});
