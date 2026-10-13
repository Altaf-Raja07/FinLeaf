"use server";

import { resolveCounterparty } from "@/lib/banking/account";

/**
 * Recipient lookup.
 *
 * Returns the recipient's *name* and nothing else — no balance, no phone
 * number, no village. Being able to see the name is what makes a mistyped
 * account number obvious before the money moves; anything more would leak a
 * stranger's account details to anyone who typed a plausible number.
 *
 * An unknown identifier returns the same shape as a failure, so the form cannot
 * be used to enumerate which account numbers and phone numbers exist.
 */

export async function lookupRecipient(
  identifier: string,
): Promise<{ ok: true; name: string } | { ok: false; message: string }> {
  const trimmed = identifier.trim();

  // Only a well-formed account number or E.164 phone number is worth a query;
  // partial input is handled by the caller.
  const looksLikeAccountNumber = /^\d{12}$/.test(trimmed);
  const looksLikePhone = /^\+[1-9]\d{7,14}$/.test(trimmed);

  if (!looksLikeAccountNumber && !looksLikePhone) {
    return { ok: false, message: "Enter a 12-digit account number or a phone number." };
  }

  const recipient = await resolveCounterparty(trimmed);

  if (!recipient) {
    return { ok: false, message: "We could not find that account or phone number." };
  }

  return { ok: true, name: recipient.name };
}
