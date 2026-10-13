"use client";

import { useActionState, useState } from "react";
import { Alert, Button } from "@/components/ui";
import { repayLoanAction } from "./repay-action";
import { formatMoney } from "@/lib/i18n";

/**
 * Repay an instalment.
 *
 * Opens a form rather than repaying on click, because the amount is editable: a
 * user may want to pay exactly the instalment, pay everything early, or pay
 * more than the instalment to shorten the term. None of those should need a
 * separate page.
 *
 * Submitting does not redirect. The user stays on the loans page and sees the
 * repayment confirmed in place, because that is where the schedule they are
 * tracking lives.
 */

interface State {
  error?: string;
  message?: string;
}

const initialState: State = {};

export function RepayButton({
  loanId,
  amount,
  dueDate,
}: {
  loanId: string;
  amount: string;
  dueDate: string;
}) {
  const [state, formAction, pending] = useActionState(repayLoanAction, initialState);
  const [showForm, setShowForm] = useState(false);

  if (!showForm) {
    return (
      <Button type="button" onClick={() => setShowForm(true)}>
        Pay {formatMoney(amount)} · due {dueDate}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex min-w-64 flex-col gap-3">
      <input type="hidden" name="loanId" value={loanId} />

      <label htmlFor={`repay-${loanId}`} className="field-label">
        Amount to repay
      </label>
      <input
        id={`repay-${loanId}`}
        name="amount"
        type="number"
        inputMode="decimal"
        min="1"
        step="0.01"
        defaultValue={amount}
        className="input tnum"
        required
      />

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Confirm repayment
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
          Cancel
        </Button>
      </div>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}
    </form>
  );
}
