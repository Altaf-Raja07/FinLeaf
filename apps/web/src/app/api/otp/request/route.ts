import { rateLimit, RATE_LIMITS, clientIp, rateLimitHeaders } from "@/lib/rate-limit";
import { requestOtpSchema, verifyOtpSchema } from "@/lib/validation";
import { requestOtp, verifyOtp, OTP_TTL_MINUTES } from "@/lib/auth/otp";
import { ok, fail, handleRoute } from "@/lib/api";
import { log } from "@/lib/env";

/**
 * OTP request endpoint.
 *
 * Rate limited per phone *and* per IP, because the two attack shapes are
 * different: many requests for one number is SMS bombing, and one request for
 * many numbers is a registration oracle.
 */

export const POST = handleRoute(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = requestOtpSchema.safeParse(body);
  if (!parsed.success) {
    return fail(422, "invalid_request", "Check the phone number and try again");
  }

  const { phone, purpose, locale } = parsed.data;
  const ip = clientIp(request.headers);

  const [byPhone, byIp] = await Promise.all([
    rateLimit(`otp:req:phone:${phone}`, RATE_LIMITS.otpRequest),
    rateLimit(`otp:req:ip:${ip}`, RATE_LIMITS.generic),
  ]);

  if (!byPhone.allowed || !byIp.allowed) {
    const retryAfter = Math.max(
      byPhone.retryAfterSeconds,
      byIp.retryAfterSeconds,
    );
    log("warn", "otp request rate limited", { purpose });
    return ok(
      { delivered: false, reason: "rate_limited", retryAfterSeconds: retryAfter },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(byPhone),
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  const result = await requestOtp({ phone, purpose, locale });

  if (!result.ok) {
    if (result.reason === "cooldown") {
      return ok(
        { delivered: false, reason: "cooldown", retryAfterSeconds: result.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
      );
    }
    return fail(503, "sms_unavailable", "We could not send a code just now. Please try again.");
  }

  return ok({
    delivered: true,
    expiresAt: result.expiresAt,
    ttlMinutes: OTP_TTL_MINUTES,
  });
});
