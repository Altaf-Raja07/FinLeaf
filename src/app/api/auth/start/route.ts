import { NextResponse } from "next/server";
import { queryOne } from "@/lib/db";
import { handler } from "@/lib/api";
import { normalisePhone, validatePhone } from "@/lib/phone";

/**
 * Step 1 of sign-in: check the phone number exists, then advance to the OTP step.
 *
 * There is no SMS provider. The code is not generated, stored, or sent; the OTP
 * page shows the fixed demo code instead. This endpoint only validates the number
 * so the flow has a real failure path.
 */

export async function POST(request: Request) {
  return handler(async () => {
    const form = await request.formData();
    const raw = String(form.get("phone") ?? "");

    const problem = validatePhone(raw);
    if (problem) {
      return NextResponse.redirect(
        new URL(`/login?error=${encodeURIComponent(problem)}`, request.url),
        { status: 303 }
      );
    }

    // Normalised before lookup so "+91 98765 43210" matches "+919876543210".
    const phone = normalisePhone(raw);

    const user = await queryOne<{ id: number }>("SELECT id FROM users WHERE phone = $1", [phone]);

    if (!user) {
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent("We could not find that number. Create an account first.")}`,
          request.url
        ),
        { status: 303 }
      );
    }

    return NextResponse.redirect(
      new URL(`/login?step=otp&phone=${encodeURIComponent(phone)}`, request.url),
      { status: 303 }
    );
  })();
}