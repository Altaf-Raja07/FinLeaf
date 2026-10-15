import { rateLimit, RATE_LIMITS, clientIp } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";
import { registerWithOtp, issueSession } from "@/lib/auth/service";
import { verifyOtp } from "@/lib/auth/otp";
import { ok, fail, handleRoute } from "@/lib/api";
import { log } from "@/lib/env";

/**
 * Registration.
 *
 * The OTP must be verified first: the account is created only once the phone
 * number has been proven, so no account exists that cannot be logged into.
 */

export const POST = handleRoute(async (request: Request) => {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    const fields = Object.fromEntries(
      parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
    );
    return fail(422, "invalid_request", "Check the highlighted fields", fields);
  }

  const ip = clientIp(request.headers);
  const limited = await rateLimit(`signup:ip:${ip}`, RATE_LIMITS.signUp);
  if (!limited.allowed) {
    return ok(
      { ok: false, reason: "rate_limited", retryAfterSeconds: limited.retryAfterSeconds },
      {
        status: 429,
        headers: { "Retry-After": String(limited.retryAfterSeconds) },
      },
    );
  }

  const { name, phone, village, password, preferredLang, otpCode } = parsed.data;

  const verified = await verifyOtp({ phone, purpose: "REGISTRATION", code: otpCode });
  if (!verified.ok) {
    return ok(
      { ok: false, reason: verified.reason === "locked" ? "code_locked" : "code_invalid" },
      { status: verified.reason === "locked" ? 429 : 400 },
    );
  }

  const created = await registerWithOtp({
    name,
    phone,
    village,
    password,
    preferredLang,
  });

  if (!created.ok) {
    return ok({ ok: false, reason: created.code, message: created.message }, { status: 409 });
  }

  await issueSession(created.userId);

  log("info", "registration complete", { userId: created.userId });

  return ok({ ok: true, userId: created.userId }, { status: 201 });
});
