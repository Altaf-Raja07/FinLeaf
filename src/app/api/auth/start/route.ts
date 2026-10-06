import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { handler } from "@/lib/api";
import { normalisePhone, validatePhone } from "@/lib/phone";
import { issueOtp } from "@/lib/otp";
import { redirectUrl } from "@/lib/redirect";

/**
 * Step 1 of sign-in: validate the number, issue a one-time code, advance to the
 * code entry step.
 *
 * The same response is returned whether or not the number is registered. A
 * different error for an unknown number turns this endpoint into a way to
 * enumerate which phone numbers hold accounts, so both paths look identical from
 * the outside.
 *
 * Redirects are built from the request's own origin, so the Location header stays
 * on the host that served the request and the session cookie survives the hop.
 */

export async function POST(request: Request) {
  return handler(async () => {
    const form = await request.formData();
    const raw = String(form.get("phone") ?? "");

    // Normalised before lookup so "+91 98765 43210" matches "+919876543210".
    const phone = normalisePhone(raw);

    const toLogin = (params: Record<string, string>) =>
      NextResponse.redirect(redirectUrl(request.url, "/login", params), { status: 303 });

    const problem = validatePhone(raw);
    if (problem) return toLogin({ error: problem });

    const user = await queryOne<{ id: number }>("SELECT id FROM users WHERE phone = $1", [phone]);

    // Issue a code even for an unknown number, so the response shape and timing do
    // not reveal which numbers exist.
    const issued = await issueOtp(phone, request);

    if (!issued) {
      // Rate limited. Say so rather than implying a code was sent.
      return toLogin({
        error: "Too many codes requested. Wait a while before trying again.",
      });
    }

    if (!user) {
      // Same destination as success, so the flow cannot be used to probe for
      // registered numbers. Verification will fail later with a neutral message.
      return toLogin({ step: "otp", phone, delivery: "unavailable" });
    }

    return toLogin({
      step: "otp",
      phone,
      delivery: issued.delivery,
      // Only present when there is no gateway, in which case the UI shows it.
      ...(issued.code ? { devCode: issued.code } : {}),
    });
  })();
}