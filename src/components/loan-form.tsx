"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Notice, Textarea } from "@/components/ui";

/**
 * Loan application form.
 *
 * The client-side cap is a convenience only. The server recomputes the limit from
 * the trust score and refuses anything above it, so the cap cannot be bypassed
 * by editing the request.
 */
export function LoanApplyForm({
  maxAmountPaise,
  initialAmountPaise,
  instalments,
  instalmentPaise,
}: {
  maxAmountPaise: number;
  initialAmountPaise: number;
  instalments: number;
  instalmentPaise: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState((initialAmountPaise / 100).toString());
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const rupees = Number(amount);
  const amountPaise = Number.isFinite(rupees) ? Math.round(rupees * 100) : 0;
  const overLimit = amountPaise > maxAmountPaise;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || overLimit || amountPaise <= 0) return;

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/loans/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ principalPaise: amountPaise, purpose: purpose.trim() || undefined }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "We could not record that application.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="p-5">
        <h3 className="text-[17px] font-semibold">Application recorded</h3>
        <p className="mt-1 text-[14px] text-muted">
          Its status is tracked on the loans page. Nothing is disbursed in this prototype.
        </p>
        <Link
          href="/loans"
          className="mt-4 inline-flex h-11 items-center rounded-md bg-primary px-5 font-semibold text-white hover:bg-primary-hover"
        >
          See my applications
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="p-5">
      <div className="flex flex-col gap-4">
        <Field
          label="Amount (₹)"
          htmlFor="principal"
          hint={`Your limit is ${(maxAmountPaise / 100).toLocaleString("en-IN")} rupees`}
          error={overLimit ? "That is above the limit your trust score allows." : undefined}
        >
          <Input
            id="principal"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            invalid={overLimit}
            required
          />
        </Field>

        <div className="rounded-md bg-sunken p-4">
          <p className="text-[13px] text-muted">Repayment</p>
          <p className="mt-1 text-[15px] font-semibold">
            {instalments} monthly instalments of{" "}
            <span className="fl-num">{(instalmentPaise / 100).toLocaleString("en-IN")}</span> rupees
          </p>
        </div>

        <Field label="What is it for (optional)" htmlFor="purpose">
          <Textarea
            id="purpose"
            rows={3}
            maxLength={200}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Festival advance for the harvest"
          />
        </Field>

        <Notice tone="neutral">
          Submitting records an application only. No money moves and no credit is granted.
        </Notice>

        {error && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy || overLimit || amountPaise <= 0}>
          {busy ? "Recording…" : "Submit application"}
        </Button>
      </div>
    </form>
  );
}