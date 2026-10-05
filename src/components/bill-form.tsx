"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Notice, Select } from "@/components/ui";

/**
 * Bill payment form.
 *
 * The idempotency key is created once per form instance, and the button is
 * disabled while in flight, so a double tap cannot record two payments. The
 * server enforces the same rule independently.
 */

const BILLERS: Record<string, string[]> = {
  bills: ["Uttar Pradesh Power Corp", "Karnataka Water Board", "Indane Gas", "BESCOM"],
  recharge: ["Airtel", "Jio", "Sun Direct TV", "KSRTC Bus pass"],
};

export function BillPayForm({
  defaultCategory,
  balancePaise,
}: {
  defaultCategory: string;
  balancePaise: number;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(defaultCategory === "recharge" ? "recharge" : "bills");
  const [biller, setBiller] = useState("");
  const [consumer, setConsumer] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ co2e: number; points: number; balance: number } | null>(null);
  const [key] = useState(() => `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  const rupees = Number(amount);
  const amountPaise = Number.isFinite(rupees) ? Math.round(rupees * 100) : 0;
  const insufficient = amountPaise > balancePaise;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || insufficient || amountPaise <= 0 || !biller) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/bills/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          merchant: biller,
          amountPaise,
          // Bills carry a due date so on-time payment stays measurable; a
          // recharge is paid on the spot, so it is simply due now.
          dueAt: new Date().toISOString(),
          idempotencyKey: key,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "We could not record that payment.");
        return;
      }
      setReceipt({
        co2e: payload.data.co2eKg ?? 0,
        points: payload.data.points ?? 0,
        balance: payload.data.balanceAfter ?? 0,
      });
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (receipt) {
    return (
      <div className="p-5">
        <h3 className="text-[17px] font-semibold">Payment recorded</h3>
        <dl className="mt-3 flex flex-col gap-2">
          <div className="flex justify-between">
            <dt className="text-[13px] text-muted">Estimated emissions</dt>
            <dd className="fl-num text-[13px]">{receipt.co2e.toFixed(2)} kg CO2e</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[13px] text-muted">Green points earned</dt>
            <dd className="fl-num text-[13px]">{receipt.points}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-[13px] text-muted">New balance</dt>
            <dd className="fl-num text-[15px] font-semibold">
              ₹{(receipt.balance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-5">
      <div className="flex flex-col gap-4">
        <Field label="Payment type" htmlFor="category">
          <Select
            id="category"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setBiller("");
            }}
          >
            <option value="bills">Bill</option>
            <option value="recharge">Recharge</option>
          </Select>
        </Field>

        <Field label="Biller" htmlFor="biller">
          <Select id="biller" value={biller} onChange={(e) => setBiller(e.target.value)} required>
            <option value="">Choose a biller</option>
            {(BILLERS[category] ?? []).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Consumer number" htmlFor="consumer">
          <Input
            id="consumer"
            inputMode="numeric"
            placeholder="8845120397"
            value={consumer}
            onChange={(e) => setConsumer(e.target.value)}
          />
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

        <Notice tone="neutral">
          Simulated payment for demonstration. Your carbon estimate and green points are recorded
          from the real transaction.
        </Notice>

        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy || insufficient || amountPaise <= 0 || !biller}>
          {busy ? "Recording…" : amountPaise > 0 ? `Pay ₹${(amountPaise / 100).toLocaleString("en-IN")}` : "Pay"}
        </Button>
      </div>
    </form>
  );
}