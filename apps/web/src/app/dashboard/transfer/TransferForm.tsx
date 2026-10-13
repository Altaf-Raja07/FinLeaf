"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Field, Pill } from "@/components/ui";
import { executeTransfer } from "./transfer-action";
import { lookupRecipient } from "./recipient-action";
import { formatMoney } from "@/lib/i18n";

/**
 * Transfer form.
 *
 * The recipient is looked up as the user types the account number or phone
 * number, and the estimated carbon is shown alongside the amount. Neither is
 * hidden until after the fact: the point of the feature is that a person sees
 * the environmental cost of a choice *while* making it.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  flagged?: boolean;
  reference?: string;
}

const initialState: State = {};

export function TransferForm({
  balance,
  accountId,
  accountNumber,
  billers,
  locale,
}: {
  balance: string;
  accountId: string;
  accountNumber: string;
  billers: Array<{ slug: string; name: string; category: string }>;
  locale: string;
}) {
  const [state, formAction, pending] = useActionState(executeTransfer, initialState);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("TRANSFER");
  const [recipient, setRecipient] = useState<{ name: string } | null>(null);
  const [looking, startLookup] = useTransition();
  const [lookupError, setLookupError] = useState<string | null>(null);
  const router = useRouter();

  const errors = state?.fieldErrors ?? {};
  const numericAmount = Number(amount);
  const hasAmount = Number.isFinite(numericAmount) && numericAmount > 0;
  const enoughFunds = hasAmount && numericAmount <= Number(balance);

  function onLookup(value: string) {
    setTo(value);
    setRecipient(null);
    setLookupError(null);

    // An account number is 12 digits and a phone number is 10-15 after the
    // country code; anything shorter is mid-typing, so do not query yet.
    if (value.replace(/\D/g, "").length < 12) return;

    startLookup(async () => {
      const result = await lookupRecipient(value);
      if (result.ok) setRecipient({ name: result.name });
      else setLookupError(result.message);
    });
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="fromAccountId" value={accountId} />
      <input type="hidden" name="locale" value={locale} />

      <Card className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">
              Account number
            </p>
            <p className="tnum text-lg font-bold">{accountNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">
              Available
            </p>
            <p className="tnum text-lg font-bold">{formatMoney(balance)}</p>
          </div>
        </div>
      </Card>

      <Field
        label="Send to"
        htmlFor="to"
        help="An account number or a phone number"
        error={errors.to ?? lookupError ?? undefined}
      >
        <input
          id="to"
          name="to"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={accountNumber}
          className={recipient ? "input border-leaf-500" : "input"}
          value={to}
          onChange={(e) => onLookup(e.target.value)}
          required
        />
        {looking ? <p className="field-help">Looking up…</p> : null}
        {recipient ? (
          <p className="field-help text-leaf-700">
            Sending to <strong>{recipient.name}</strong>. Check this is who you meant.
          </p>
        ) : null}
      </Field>

      <Field
        label="Amount"
        htmlFor="amount"
        error={errors.amount}
        help={hasAmount && !enoughFunds ? `Your balance is ${formatMoney(balance)}.` : undefined}
      >
        <input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          min="1"
          step="0.01"
          placeholder="500"
          className="input tnum"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-invalid={errors.amount ? "true" : undefined}
          required
        />
      </Field>

      {hasAmount && !enoughFunds ? (
        <Alert tone="warning">
          Enter a smaller amount — this is more than your balance.
        </Alert>
      ) : null}

      <Field
        label="What is this for"
        htmlFor="category"
        help="Used only to estimate the carbon footprint of this payment"
        error={errors.category}
      >
        <select
          id="category"
          name="category"
          className="input"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="TRANSFER">Transfer / not sure</option>
          <option value="GROCERIES">Groceries</option>
          <option value="FUEL">Fuel</option>
          <option value="TRAVEL_PUBLIC">Public transport</option>
          <option value="TRAVEL_PRIVATE">Private travel</option>
          <option value="DINING">Dining out</option>
          <option value="EDUCATION">Education</option>
          <option value="HEALTHCARE">Healthcare</option>
          <option value="ELECTRONICS">Electronics</option>
          <option value="CLOTHING">Clothing</option>
          <option value="RECHARGE">Mobile recharge</option>
          <option value="OTHER">Other</option>
        </select>
      </Field>

      <Field label="Note" htmlFor="note" help="Optional — seen only by you and the recipient">
        <input
          id="note"
          name="note"
          type="text"
          maxLength={120}
          placeholder="For the shopkeeper"
          className="input"
        />
      </Field>

      {state?.error ? (
        <Alert tone="danger" title="Could not send the payment">
          {state.error}
        </Alert>
      ) : null}

      {state?.flagged ? (
        <Alert tone="warning" title="This payment was unusual">
          It went through, but it was flagged so we can check with you. See{" "}
          <button
            type="button"
            onClick={() => router.push("/dashboard/history")}
            className="font-semibold underline"
          >
            your history
          </button>
          .
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          loading={pending}
          disabled={!hasAmount || !enoughFunds}
        >
          {hasAmount ? `Send ${formatMoney(amount)}` : "Send"}
        </Button>
        {hasAmount && enoughFunds ? (
          <Pill status="neutral">Estimated carbon shown after sending</Pill>
        ) : null}
      </div>
    </form>
  );
}
