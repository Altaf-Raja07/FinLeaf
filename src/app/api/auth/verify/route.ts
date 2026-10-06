import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { handler } from "@/lib/api";
import { normalisePhone } from "@/lib/phone";
import { verifyOtp } from "@/lib/otp";
import { redirectUrl } from "@/lib/redirect";

/**
 * Step 2 of sign-in: verify the one-time code and open a session.
 *
 * Failure messages are deliberately uniform. Distinguishing "wrong code" from
 * "no code was ever issued" from "that number has no account" would let an
 * attacker map the system without holding a valid code, so the user is simply
 * told the code was not accepted and to try again.
 *
 * The cookie is httpOnly and SameSite=Lax, so it cannot be read from JavaScript
 * and is not attached to cross-site form posts.
 */

export async function POST(request: Request) {
  return handler(async () => {
    const form = await request.formData();
    const phone = normalisePhone(String(form.get("phone") ?? ""));
    const code = String(form.get("otp") ?? "").trim();

    const failTo = (message: string) =>
      NextResponse.redirect(
        redirectUrl(request.url, "/login", { step: "otp", phone, error: message }),
        { status: 303 }
      );

    if (!/^\d{6}$/.test(code)) {
      return failTo("Enter the six-digit code.");
    }

    const result = await verifyOtp(phone, code, request);

    if (!result.ok) {
      // One message for every failure mode. The specifics are logged, not shown.
      if (result.reason === "mismatch") {
        console.warn(`[auth] otp mismatch for ${phone}, ${result.remaining} attempts left`);
      }
      return failTo("That code was not accepted. Check it and try again.");
    }

    const user = await queryOne<{ id: number }>("SELECT id FROM users WHERE phone = $1", [phone]);
    if (!user) {
      console.warn(`[auth] verified a code for an unregistered number ${phone}`);
      return failTo("That code was not accepted. Check it and try again.");
    }

    const token = await createSession(user.id, request.headers.get("user-agent") ?? undefined);
    const store = await cookies();
    store.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Number(process.env.SESSION_TTL_DAYS ?? 7) * 86_400,
    });

    return NextResponse.redirect(redirectUrl(request.url, "/dashboard"), { status: 303 });
  })();
}