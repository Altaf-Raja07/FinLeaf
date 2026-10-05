import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { handler } from "@/lib/api";
import { normalisePhone, validatePhone } from "@/lib/phone";
import { redirectUrl } from "@/lib/redirect";

/**
 * Step 1 of sign-in: check the phone number exists, then advance to the OTP step.
 *
 * There is no SMS provider. The code is not generated, stored, or sent; the OTP
 * page shows the fixed demo code instead. This endpoint only validates the number
 * so the flow has a real failure path.
 *
 * Redirects are built from the request's own origin, so the Location header stays
 * on the host that served the request.
 */

export async function POST(request: Request) {
  return handler(async () => {
    const form = await request.formData();
    const raw = String(form.get("phone") ?? "");

    const problem = validatePhone(raw);
    if (problem) {
      return NextResponse.redirect(redirectUrl(request.url, "/login", { error: problem }), {
        status: 303,
      });
    }

    // Normalised before lookup so "+91 98765 43210" matches "+919876543210".
    const phone = normalisePhone(raw);

    const user = await queryOne<{ id: number }>("SELECT id FROM users WHERE phone = $1", [phone]);
    if (!user) {
      return NextResponse.redirect(
        redirectUrl(request.url, "/login", {
          error: "We could not find that number. Create an account first.",
        }),
        { status: 303 }
      );
    }

    return NextResponse.redirect(redirectUrl(request.url, "/login", { step: "otp", phone }), {
      status: 303,
    });
  })();
}