import { NextResponse } from "next/server";
import { z } from "zod";
import dotenv from "dotenv";
import { withTransaction, queryOne } from "@/lib/db";
import { hashPassword, createSession, SESSION_COOKIE } from "@/lib/auth";
import { normalisePhone, validatePhone } from "@/lib/phone";
import { redirectUrl } from "@/lib/redirect";
import { cookies } from "next/headers";
import { handler, parseBody } from "@/lib/api";

dotenv.config({ quiet: true });

/**
 * Registration.
 *
 * Creates a demo account with a wallet, then signs the user straight in.
 *
 * Deliberately minimal fields, which is the point of the inclusion work: three
 * details, no documents. The `kyc_reference` is a synthetic token; no real
 * identity document is ever requested or stored.
 */

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter your name.").max(80),
  phone: z.string().trim().min(6, "Enter a phone number."),
  language: z.enum(["en", "hi", "kn"]),
});

export async function POST(request: Request) {
  return handler(async () => {
    const input = await parseBody(request, schema);

    const phoneProblem = validatePhone(input.phone);
    if (phoneProblem) {
      return NextResponse.redirect(
        redirectUrl(request.url, "/signup", { error: phoneProblem }),
        { status: 303 }
      );
    }
    const phone = normalisePhone(input.phone);

    const taken = await queryOne<{ id: number }>("SELECT id FROM users WHERE phone = $1", [phone]);
    if (taken) {
      return NextResponse.redirect(
        redirectUrl(request.url, "/signup", {
          error: "That number already has an account. Sign in instead.",
        }),
        { status: 303 }
      );
    }

    // Every demo account shares the same fixed password so the project can be
    // demonstrated without handing out credentials. Stated in the UI.
    const { hash, salt, params } = hashPassword("finleaf123");

    const userId = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: number }>(
        `INSERT INTO users
           (phone, full_name, language, password_hash, password_salt, password_params, kyc_reference, is_demo)
         VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE)
         RETURNING id`,
        [
          phone,
          input.fullName,
          input.language,
          hash,
          salt,
          params,
          `DEMO-${phone.slice(-4)}`,
        ]
      );
      const id = inserted.rows[0].id;

      // A wallet with an opening balance, so the new account is immediately
      // usable rather than showing an empty dashboard with nothing to do.
      await client.query(
        `INSERT INTO accounts (user_id, label, kind, balance) VALUES ($1,'Main wallet','wallet',0)`,
        [id]
      );
      await client.query(
        `INSERT INTO transactions (account_id, user_id, direction, amount, category, merchant)
         SELECT a.id, $1, 'credit', 500000, 'transfer', 'Opening balance'
           FROM accounts a WHERE a.user_id = $1 AND a.kind = 'wallet'`,
        [id]
      );
      await client.query(
        `UPDATE accounts a SET balance = 500000
          WHERE a.user_id = $1 AND a.kind = 'wallet'`,
        [id]
      );

      // A first savings goal, because an empty goals screen teaches nothing.
      await client.query(
        `INSERT INTO savings_goals (user_id, title, target_amount, weekly_amount)
         VALUES ($1,'My first goal',200000,10000)`,
        [id]
      );

      return id;
    });

    const token = await createSession(userId, request.headers.get("user-agent") ?? undefined);
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