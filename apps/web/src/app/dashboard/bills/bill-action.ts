"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Prisma, type TxCategory } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { requireAccount } from "@/lib/auth/guard";
import { postTransaction } from "@/lib/banking/ledger";
import { findBiller } from "@/lib/banking/bills";
import { estimateCo2e } from "@/lib/carbon";
import { greenPointsFor } from "@/lib/carbon/factors";
import { PAPERLESS_SHEETS_PER_BILL } from "@/lib/carbon/factors";
import { generateReference } from "@/lib/crypto/hash";
import { fieldErrors, billPaymentSchema } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { log } from "@/lib/env";

/**
 * Bill payment.
 *
 * Writes a transaction that debits the account and, when the biller's category
 * awards green points, credits them. The biller's own reference field is stored
 * on the transaction so the receipt can be reconciled later.
 *
 * The action returns the receipt rather than redirecting: the user needs to see
 * the reference, and a redirect would make that a second navigation.
 */

export interface BillState {
  error?: string;
  fieldErrors?: Record<string, string>;
  receipt?: { reference: string; amount: string; biller: string };
}

export async function payBill(
  _prev: BillState,
  formData: FormData,
): Promise<BillState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const account = await requireAccount(user.id);

  const parsed = billPaymentSchema.safeParse({
    billerSlug: String(formData.get("billerSlug") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    customerRef: formData.get("customerRef")
      ? String(formData.get("customerRef"))
      : undefined,
    reference: String(formData.get("reference") ?? "") || generateReference("bill"),
  });

  if (!parsed.success) {
    return { error: "Check the details above.", fieldErrors: fieldErrors(parsed.error) };
  }

  const biller = await findBiller(parsed.data.billerSlug);
  if (!biller) {
    return { error: "That biller is not available." };
  }

  // The biller's own record decides whether a reference is required; the form
  // shows the field, this is the check that the value arrived.
  if (biller.requiresRef && !parsed.data.customerRef) {
    return {
      error: `Enter the ${biller.refLabel ?? "reference"} shown on your bill.`,
    };
  }

  // Resolve the reference-file slug to the database row, if it is seeded. A
  // biller present in the curated file but not yet seeded still works — the
  // link is optional and the biller name is stored on the transaction note.
  const billerRow = await prisma.biller
    .findUnique({ where: { slug: biller.slug }, select: { id: true } })
    .catch(() => null);
  const billerId = billerRow?.id ?? null;

  const carbon = await estimateCo2e(
    biller.category,
    Number(parsed.data.amount),
    // A write path must not hold a database transaction open across an HTTP
    // call, so this uses the static table.
    { preferRemote: false, locale: user.preferredLang },
  );

  const points = greenPointsFor(biller.category);

  try {
    await postTransaction({
      reference: parsed.data.reference,
      // The biller's category decides the ledger type: a recharge is a top-up,
      // an electricity bill is a bill payment.
      type: biller.category === "RECHARGE" ? "RECHARGE" : "BILL_PAYMENT",
      // The biller file stores the category as a plain string; it is validated
      // against the enum here rather than cast, so a typo in the data file
      // fails loudly instead of writing an invalid category to the ledger.
      category: toCategory(biller.category),
      amount: new Prisma.Decimal(parsed.data.amount),
      note: parsed.data.customerRef
        ? `${biller.name} · ref ${parsed.data.customerRef}`
        : biller.name,
      fromAccountId: account.id,
      fromUserId: user.id,
      billerId: billerId,
      co2eSource: carbon.source,
      greenPoints: points,
      afterCreate: async (tx, transaction) => {
        if (points > 0) {
          await tx.user.update({
            where: { id: user.id },
            data: { greenPoints: { increment: points } },
          });
        }

        await tx.user.update({
          where: { id: user.id },
          data: { paperlessSheets: { increment: PAPERLESS_SHEETS_PER_BILL } },
        });

        await recordAudit({
          userId: user.id,
          action: "TRANSFER_SENT",
          detail: {
            reference: transaction.reference,
            amount: parsed.data.amount.toString(),
            biller: biller.slug,
            kind: "bill_payment",
          },
        });
      },
    });
  } catch (error) {
    log("error", "bill payment failed", {
      userId: user.id,
      biller: biller.slug,
      reason: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That payment has already been recorded." };
    }

    return { error: "We could not record that payment. Please try again." };
  }

  revalidatePath("/dashboard", "page");
  revalidatePath("/dashboard/bills", "page");

  // Refresh the trust score in the background: paying a bill is exactly the
  // activity that moves the scoring features.
  const { refreshTrustScore } = await import("@/lib/trust");
  const { refreshSustainabilityScore } = await import("@/lib/sustainability");
  await Promise.all([
    refreshTrustScore(user.id),
    refreshSustainabilityScore(user.id),
  ]);

  return {
    receipt: {
      reference: parsed.data.reference,
      amount: parsed.data.amount.toString(),
      biller: biller.name,
    },
  };
}


/** Maps a biller-file category onto the ledger's enum, defaulting to OTHER. */
function toCategory(value: string): TxCategory {
  const valid: TxCategory[] = [
    "GROCERIES", "FUEL", "TRAVEL_PUBLIC", "TRAVEL_PRIVATE", "ELECTRICITY",
    "DINING", "EDUCATION", "HEALTHCARE", "ELECTRONICS", "CLOTHING",
    "HOUSING", "RENT", "SALARY", "TRANSFER", "BILL_PAYMENT", "RECHARGE",
    "LOAN", "SAVINGS", "GREEN_REWARD", "OFFSET", "OTHER",
  ];
  return (valid as string[]).includes(value) ? (value as TxCategory) : "OTHER";
}
