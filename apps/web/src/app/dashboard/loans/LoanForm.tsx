"use client";

import { useActionState, useMemo, useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { applyForLoanAction } from "./loan-action";
import { formatMoney } from "@/lib/i18n";

/**
 * Loan application.
 *
 * The total repayable is shown before the user commits, because "borrow 5,000"
 * and "repay 5,200" are very different commitments and only showing the first
 * would hide the cost of the loan.
 *
 * The amount is capped at the computed limit server-side as well as here; the
 * client cap is for usability and the server cap is the one that counts.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  approved?: { loanId: string; outstanding: string };
}

const initialState: State = {};

export function LoanForm({
  maxAmount,
  interestRate,
  maxTermMonths,
}: {
  maxAmount: number;
  interestRate: number;
  maxTermMonths: number;
}) {
  const [state, formAction, pending] = useActionState(applyForLoanAction, initialState);
  const [amount, setAmount] = useState(String(maxAmount));
  const [termMonths, setTermMonths] = useState(String(maxTermMonths));
  const errors = state?.fieldErrors ?? {};

  const numericAmount = Number(amount);
  const hasAmount = Number.isFinite(numericAmount) && numericAmount > 0;
  const withinLimit = hasAmount && numericAmount <= maxAmount;

  // Repayment is disclosed up front, not discovered later.
  const totalRepayable = useMemo(
    () => numericAmount + numericAmount * interestRate,
    [numericAmount, interestRate],
  );

  const monthly = useMemo(
    () => (termMonths ? totalRepayable / Number(termMonths) : totalRepayable),
    [totalRepayable, termMonths],
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="How much do you need"
        htmlFor="loan-amount"
        help={`Up to ${formatMoney(maxAmount.toString())}`}
        error={errors.amount}
      >
        <input
          id="loan-amount"
          name="amount"
          type="number"
          inputMode="decimal"
          min="1"
          max={maxAmount}
          step="10"
          className="input tnum"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={errors.amount ? "true" : undefined}
          required
        />
      </Field>

      <Field
        label="Over how many months"
        htmlFor="loan-term"
        help={`Up to ${maxTermMonths} months`}
        error={errors.termMonths}
      >
        <select
          id="loan-term"
          name="termMonths"
          className="input"
          value={termMonths}
          onChange={(e) => setTermMonths(e.target.value)}
        >
          {Array.from({ length: maxTermMonths }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m} {m === 1 ? "month" : "months"}
            </option>
          ))}
        </select>
      </Field>

      {hasAmount ? (
        <div className="card-quiet flex flex-col gap-1">
          <div className="flex justify-between gap-3">
            <span className="field-help">You receive</span>
            <span className="font-bold tnum">{formatMoney(numericAmount.toString())}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="field-help">
              Interest ({(interestRate * 100).toFixed(2)}% total)
            </span>
            <span className="font-bold tnum">{formatMoney((numericAmount * interestRate).toString())}</span>
          </div>
          <div className="flex justify-between gap-3 border-t border-rule pt-1">
            <span className="text-sm font-bold">You repay in total</span>
            <span className="text-sm font-bold tnum">{formatMoney(totalRepayable.toString())}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="field-help">
              {Number(termMonths) === 1 ? "One instalment" : `${termMonths} instalments of`}
            </span>
            <span className="tnum">{formatMoney(monthly.toString())}</span>
          </div>
        </div>
      ) : null}

      {!withinLimit && hasAmount ? (
        <Alert tone="warning">
          That is above your limit of {formatMoney(maxAmount.toString())}.
        </Alert>
      ) : null}

      {state?.error ? (
        <Alert tone="danger" title="Could not create the loan">
          {state.error}
        </Alert>
      ) : null}

      {state?.approved ? (
        <Alert tone="success" title="Loan disbursed">
          {formatMoney(state.approved.outstanding)} is now in your account. Paying on
          time regularly is what raises your trust score and so your next limit.
        </Alert>
      ) : null}

      <Button type="submit" loading={pending} disabled={!withinLimit}>
        Apply for {hasAmount ? formatMoney(amount) : "a loan"}
      </Button>
    </form>
  );
}
