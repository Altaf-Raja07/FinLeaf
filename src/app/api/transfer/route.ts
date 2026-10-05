import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { withTransaction, queryOne } from "@/lib/db";
import { transferMoney } from "@/lib/wallet";
import { handler, parseBody, ApiError } from "@/lib/api";

/**
 * Simulated transfer between two seeded users.
 *
 * Safety lives in `transferMoney`: one SQL transaction, a row lock on the sending
 * account, a conditional UPDATE that re-asserts the balance, and an idempotency
 * key so a double-submitted form cannot move the money twice.
 */

const schema = z.object({
  recipientId: z.number().int().positive(),
  amountPaise: z.number().int().positive().max(10_000_000),
  note: z.string().max(140).optional(),
  idempotencyKey: z.string().min(8).max(120),
});

export async function POST(request: Request) {
  return handler(async () => {
    const user = await getSessionUser();
    if (!user) throw new ApiError("unauthorized", "Sign in to send money.");

    const input = await parseBody(request, schema);

    const result = await withTransaction(async (client) => {
      // Sending wallet.
      const from = await client.query<{ id: number }>(
        `SELECT id FROM accounts WHERE user_id = $1 AND kind = 'wallet' ORDER BY id LIMIT 1`,
        [user.id]
      );
      if (from.rowCount === 0) throw new ApiError("not_found", "You have no wallet to send from.");

      // A counterparty row belongs to the sender and identifies the recipient by
      // phone, since an agent may have a phone number with no FinLeaf account
      // behind it. Joining to users on the phone is what resolves the destination
      // account; a counterparty with no matching user is rejected.
      const recipient = await client.query<{ user_id: number; account_id: number }>(
        `SELECT u.id AS user_id, a.id AS account_id
           FROM counterparties c
           JOIN users u ON u.phone = c.phone
           JOIN accounts a ON a.user_id = u.id AND a.kind = 'wallet'
          WHERE c.owner_user_id = $1 AND c.id = $2
          LIMIT 1`,
        [user.id, input.recipientId]
      );
      if (recipient.rowCount === 0 || recipient.rows[0].user_id === user.id) {
        throw new ApiError("not_found", "Choose someone from your list.");
      }

      return transferMoney(client, {
        userId: user.id,
        fromAccountId: from.rows[0].id,
        toUserId: recipient.rows[0].user_id,
        toAccountId: recipient.rows[0].account_id,
        amountPaise: input.amountPaise,
        note: input.note,
        idempotencyKey: input.idempotencyKey,
      });
    });

    return NextResponse.json({
      ok: true as const,
      data: {
        transferGroupId: result.transferGroupId,
        amountPaise: result.amountPaise,
        balanceAfter: result.balanceAfter,
        // Surfaced so the client can tell the user their tap was not charged twice.
        duplicate: result.duplicate,
      },
    });
  })();
}