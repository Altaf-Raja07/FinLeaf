"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { RATE_LIMITS, rateLimit, clientIp } from "@/lib/rate-limit";
import type { TxCategory } from "@/generated/prisma/enums";

/**
 * Statement export.
 *
 * The export is generated server-side from the same filters the history page
 * applied, and is rate limited: a CSV of every transaction is a meaningful
 * quantity of personal data, and an endpoint that hands it out for free is a
 * data-harvesting target.
 *
 * The history page passes its Prisma `where` as a JSON string. It is
 * re-validated here rather than trusted, because it arrives from the client.
 */

interface ExportFilter {
  OR?: Array<Record<string, unknown>>;
  category?: string;
  createdAt?: { gte?: string; lte?: string };
  amount?: { gte?: number; lte?: number };
}

export async function exportStatement(whereJson: string): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const ip = clientIp(await headers());
  const limited = await rateLimit(`export:user:${user.id}`, RATE_LIMITS.generic);
  if (!limited.allowed) {
    throw new Error("Too many exports in a short time. Please wait a moment.");
  }
  const ipLimited = await rateLimit(`export:ip:${ip}`, RATE_LIMITS.generic);
  if (!ipLimited.allowed) {
    throw new Error("Too many exports from this network. Please wait a moment.");
  }

  // The client only ever legitimately sends this user's own transaction scope,
  // so it is rebuilt from scratch rather than partially trusted.
  let clientFilter: ExportFilter = {};
  try {
    clientFilter = JSON.parse(whereJson) as ExportFilter;
  } catch {
    clientFilter = {};
  }

  const where = {
    fromUserId: user.id,
    ...(clientFilter.category &&
    isValidCategory(clientFilter.category)
      ? { category: clientFilter.category as TxCategory }
      : {}),
    ...(clientFilter.amount?.gte || clientFilter.amount?.lte
      ? {
          amount: {
            ...(clientFilter.amount?.gte ? { gte: clientFilter.amount.gte } : {}),
            ...(clientFilter.amount?.lte ? { lte: clientFilter.amount.lte } : {}),
          },
        }
      : {}),
    ...(clientFilter.createdAt?.gte || clientFilter.createdAt?.lte
      ? {
          createdAt: {
            ...(clientFilter.createdAt?.gte
              ? { gte: new Date(clientFilter.createdAt.gte) }
              : {}),
            ...(clientFilter.createdAt?.lte
              ? { lte: new Date(clientFilter.createdAt.lte) }
              : {}),
          },
        }
      : {}),
  };

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      reference: true,
      type: true,
      category: true,
      amount: true,
      note: true,
      co2eKg: true,
      greenPoints: true,
      status: true,
      createdAt: true,
    },
  });

  const csv = toCsv(transactions);
  redirect(`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`);
}

/** RFC 4180-quoted CSV, with the header row always present. */
function toCsv(
  rows: Array<{
    reference: string;
    type: string;
    category: string;
    amount: unknown;
    note: string | null;
    co2eKg: unknown;
    greenPoints: number;
    status: string;
    createdAt: Date;
  }>,
): string {
  const header = [
    "reference",
    "date",
    "type",
    "category",
    "amount_inr",
    "estimated_co2e_kg",
    "green_points",
    "status",
    "note",
  ];

  const lines = rows.map((row) =>
    [
      row.reference,
      row.createdAt.toISOString(),
      row.type,
      row.category,
      String(row.amount),
      row.co2eKg ? String(row.co2eKg) : "0",
      String(row.greenPoints),
      row.status,
      row.note ?? "",
    ]
      .map(escapeCsvValue)
      .join(","),
  );

  return [header.join(","), ...lines].join("\r\n");
}

/**
 * Quotes a CSV field when needed.
 *
 * A field beginning with `=`, `+`, `-` or `@` is prefixed with a tab: those are
 * spreadsheet formula characters, and a note such as `=HYPERLINK(...)` typed by
 * a recipient is code that would execute when the CSV is opened in Excel.
 */
function escapeCsvValue(value: string): string {
  const needsQuote = value.includes(",") || value.includes('"') || value.includes("\n");
  const guarded = /^[=+\-@]/.test(value) ? `\t${value}` : value;
  return needsQuote ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

function isValidCategory(value: string): value is TxCategory {
  const valid = [
    "GROCERIES", "FUEL", "TRAVEL_PUBLIC", "TRAVEL_PRIVATE", "ELECTRICITY",
    "DINING", "EDUCATION", "HEALTHCARE", "ELECTRONICS", "CLOTHING", "HOUSING",
    "RENT", "SALARY", "TRANSFER", "BILL_PAYMENT", "RECHARGE", "LOAN", "SAVINGS",
    "GREEN_REWARD", "OFFSET", "OTHER",
  ];
  return valid.includes(value);
}
