import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { checkDemoOtp, createSession, SESSION_COOKIE } from "@/lib/auth";
import { handler } from "@/lib/api";
import { normalisePhone } from "@/lib/phone";
import { redirectUrl } from "@/lib/redirect";

/**
 * Step 2 of sign-in: verify the demo OTP and open a session.
 *
 * The cookie is httpOnly and SameSite=Lax, so it cannot be read from JavaScript
 * and is not attached to cross-site form posts.
 *
 * The post-sign-in redirect is built from the request's own origin. Building it
 * from the request URL keeps the Location on the same host that set the cookie,
 * so the session survives the hop.
 */

export async function POST(request: Request) {
  return handler(async () => {
    const form = await request.formData();
    const phone = normalisePhone(String(form.get("phone") ?? ""));
    const otp = String(form.get("otp") ?? "").trim();

    const failTo = (step: string, message: string) =>
      NextResponse.redirect(redirectUrl(request.url, "/login", { step, phone, error: message }), {
        status: 303,
      });

    if (!/^\d{6}$/.test(otp)) {
      return failTo("otp", "Enter the six-digit code.");
    }
    if (!checkDemoOtp(otp)) {
      return failTo("otp", "That code does not match. Use the demo code shown above.");
    }

    const user = await queryOne<{ id: number }>("SELECT id FROM users WHERE phone = $1", [phone]);
    if (!user) {
      return failTo("phone", "We could not find that number.");
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