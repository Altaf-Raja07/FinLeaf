"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

/**
 * Transfer form.
 *
 * Two things matter for correctness here:
 *
 *  - The idempotency key is generated once per form instance, not per click, so
 *    pressing "Review" twice cannot debit the wallet twice. The server also
 *    re-checks the key, so a double-submitted form is refused even if the client
 *    misbehaves.
 *  - The button is disabled while a request is in flight. Prevents the
 *    double-submit in the first place rather than relying on cleanup.
 */

interface Recipient {
  id: number;
  name: string;
  phone: string;
  userId: number | null;
}

export function TransferForm({
  recipients,
  balancePaise,
}: {
  recipients: Recipient[];
  balancePaise: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [recipientId, setRecipientId] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ id: string; balanceAfter: number; duplicate: boolean } | null>(null);

  // Stable for the life of this form instance.
  const [idempotencyKey] = useState(
    () => `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );

  const rupees = Number(amount);
  const amountPaise = Number.isFinite(rupees) ? Math.round(rupees * 100) : 0;
  const insufficient = amountPaise > 0 && amountPaise > balancePaise;
  const chosen = recipients.find((r) => String(r.id) === recipientId);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || insufficient || amountPaise <= 0 || !recipientId) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: Number(recipientId),
          amountPaise,
          note: note.trim() || undefined,
          idempotencyKey,
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "We could not complete that transfer.");
        return;
      }
      setReceipt({
        id: payload.data.transferGroupId,
        balanceAfter: payload.data.balanceAfter,
        duplicate: payload.data.duplicate,
      });
      router.refresh();
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <div className="p-5">
        <h2 className="text-[17px] font-semibold">
          {receipt.duplicate ? "Already sent" : "Money sent"}
        </h2>
        <p className="mt-1 text-[14px] text-muted">
          {receipt.duplicate
            ? "We found this exact transfer already recorded, so nothing was charged twice."
            : `Sent to ${chosen?.name ?? "your recipient"}.`}
        </p>
        <dl className="mt-4 flex flex-col gap-2">
          <div className="flex justify-between">
            <dt className="text-[13px] text-muted">Reference</dt>
            <dd className="fl-num text-[13px]">{receipt.id.slice(0, 8).toUpperCase()}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[13px] text-muted">New balance</dt>
            <dd className="fl-num text-[15px] font-semibold">
              ₹{(receipt.balanceAfter / 100).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-5">
      <div className="flex flex-col gap-4">
        <Field label="Send to" htmlFor="recipient">
          <Select
            id="recipient"
            value={recipientId}
            onChange={(e) => setRecipientId(e.target.value)}
            required
          >
            <option value="">Choose a person</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} — {r.phone}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Amount"
          htmlFor="amount"
          hint={`Available ${(balancePaise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })} rupees`}
          error={insufficient ? "That is more than your available balance." : undefined}
        >
          <Input
            id="amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            invalid={insufficient}
            required
          />
        </Field>

        <Field label="Add a note (optional)" htmlFor="note">
          <Input
            id="note"
            maxLength={140}
            placeholder="Rent contribution"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <Notice tone="neutral">
          This is a simulated transfer between demo accounts. No real money moves.
        </Notice>

        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy || insufficient || amountPaise <= 0 || !recipientId}>
          {busy ? "Sending…" : "Send money"}
        </Button>
      </div>
    </form>
  );
}