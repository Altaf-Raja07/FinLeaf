"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Card, Field, Pill } from "@/components/ui";
import { payBill } from "./bill-action";
import { formatMoney } from "@/lib/i18n";

/**
 * Bill payment form.
 *
 * A biller that needs a reference number (a consumer or meter number) switches
 * that field on, and its label and pattern come from the biller's record rather
 * than being guessed in the UI. When the operator supplies no pattern, none is
 * enforced — better to accept an odd number than to invent a validation rule.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  receipt?: { reference: string; amount: string; biller: string };
}

const initialState: State = {};

export function BillPaymentForm({
  balance,
  accountId,
  billers,
  locale,
}: {
  balance: string;
  accountId: string;
  billers: Array<{
    slug: string;
    name: string;
    category: string;
    requiresRef: boolean;
    refLabel: string;
  }>;
  locale: string;
}) {
  const [state, formAction, pending] = useActionState(payBill, initialState);
  const [billerSlug, setBillerSlug] = useState(billers[0]?.slug ?? "");
  const [amount, setAmount] = useState("");

  const biller = billers.find((b) => b.slug === billerSlug);
  const errors = state?.fieldErrors ?? {};
  const numericAmount = Number(amount);
  const hasAmount = Number.isFinite(numericAmount) && numericAmount > 0;
  const enoughFunds = hasAmount && numericAmount <= Number(balance);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="accountId" value={accountId} />
      <input type="hidden" name="locale" value={locale} />

      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">
              Available
            </p>
            <p className="tnum text-lg font-bold">{formatMoney(balance)}</p>
          </div>
        </div>
      </Card>

      <Field label="Choose a biller" htmlFor="biller" error={errors.billerSlug}>
        <select
          id="biller"
          name="billerSlug"
          className="input"
          value={billerSlug}
          onChange={(e) => setBillerSlug(e.target.value)}
        >
          {billers.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
      </Field>

      {biller?.requiresRef ? (
        <Field
          label={biller.refLabel}
          htmlFor="customerRef"
          help="Shown on the bill or the meter"
          error={errors.customerRef}
        >
          <input
            id="customerRef"
            name="customerRef"
            type="text"
            autoComplete="off"
            className="input"
            required
          />
        </Field>
      ) : null}

      <Field label="Amount" htmlFor="amount" error={errors.amount}>
        <input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          placeholder="250"
          className="input tnum"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={errors.amount ? "true" : undefined}
          required
        />
      </Field>

      {hasAmount && !enoughFunds ? (
        <Alert tone="warning">
          Enter an amount up to your balance of {formatMoney(balance)}.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          loading={pending}
          disabled={!hasAmount || !enoughFunds || (biller?.requiresRef ?? false)}
        >
          {hasAmount ? `Pay ${formatMoney(amount)}` : "Pay"}
        </Button>
        {biller ? (
          <Pill status="good">{biller.name}</Pill>
        ) : null}
      </div>

      {state?.error ? (
        <Alert tone="danger" title="Could not pay">
          {state.error}
        </Alert>
      ) : null}

      {state?.receipt ? (
        <Alert tone="success" title="Payment recorded">
          <p>
            {formatMoney(state.receipt.amount)} recorded for{" "}
            <strong>{state.receipt.biller}</strong>. Your FinLeaf reference is{" "}
            <code className="font-mono">{state.receipt.reference}</code>.
          </p>
          <p className="mt-1">
            This is a receipt from FinLeaf only. The operator has not been paid.
          </p>
        </Alert>
      ) : null}
    </form>
  );
}
