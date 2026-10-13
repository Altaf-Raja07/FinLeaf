import { rateLimit, RATE_LIMITS, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { verifyOtpSchema } from "@/lib/validation";
import { verifyOtp } from "@/lib/auth/otp";
import { ok, fail, handleRoute } from "@/lib/api";

/**
 * OTP verification.
 *
 * Returns only whether the code was right. It does not reveal whether the phone
 * number is registered, so this endpoint cannot be used to enumerate accounts.
 */

export const POST = handleRoute(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return fail(422, "invalid_request", "Enter the 6-digit code");
  }

  const { phone, purpose, code } = parsed.data;
  const ip = clientIp(request.headers);

  const [byPhone, byIp] = await Promise.all([
    rateLimit(`otp:verify:phone:${phone}`, RATE_LIMITS.otpVerify),
    rateLimit(`otp:verify:ip:${ip}`, RATE_LIMITS.generic),
  ]);

  if (!byPhone.allowed || !byIp.allowed) {
    const retryAfter = Math.max(byPhone.retryAfterSeconds, byIp.retryAfterSeconds);
    return ok(
      { ok: false, reason: "rate_limited", retryAfterSeconds: retryAfter },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(byPhone),
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  const result = await verifyOtp({ phone, purpose, code });

  if (!result.ok) {
    return ok(
      { ok: false, reason: result.reason },
      { status: result.reason === "locked" ? 429 : 400 },
    );
  }

  return ok({ ok: true, verified: true });
});
