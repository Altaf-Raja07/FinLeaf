"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { contributeAction } from "./contribute-action";

/**
 * Add money to a goal.
 *
 * Hidden behind a button rather than shown inline, so a page with several goals
 * does not become a wall of inputs. The default amount is what the goal still
 * needs, so one tap completes it.
 */

interface State {
  error?: string;
  message?: string;
  reached?: boolean;
}

const initialState: State = {};

export function ContributeForm({
  goalId,
  maxAmount,
  title,
}: {
  goalId: string;
  maxAmount: number;
  title: string;
}) {
  const [state, formAction, pending] = useActionState(contributeAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="goalId" value={goalId} />

      <Field
        label={`Add to ${title}`}
        htmlFor={`contribute-${goalId}`}
        className="min-w-40 flex-1"
      >
        <input
          id={`contribute-${goalId}`}
          name="amount"
          type="number"
          inputMode="decimal"
          min="1"
          max={maxAmount}
          step="10"
          defaultValue={maxAmount}
          className="input tnum"
          required
        />
      </Field>

      <Button type="submit" loading={pending}>
        Add money
      </Button>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? (
        <Alert tone={state.reached ? "success" : "info"}>{state.message}</Alert>
      ) : null}
    </form>
  );
}
