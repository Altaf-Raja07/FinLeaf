"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { createGoalAction } from "./contribute-action";

/**
 * Create a savings goal.
 *
 * Three fields, one of which is optional. A goal named "school fees" with a
 * target is enough to start, and requiring a due date would be an invented
 * deadline rather than a real commitment.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  created?: boolean;
}

const initialState: State = {};

export function GoalForm() {
  const [state, formAction, pending] = useActionState(createGoalAction, initialState);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field
        label="What are you saving for"
        htmlFor="goal-title"
        error={errors.title}
        className="sm:col-span-2"
      >
        <input
          id="goal-title"
          name="title"
          type="text"
          maxLength={80}
          placeholder="School fees"
          className="input"
          required
          minLength={2}
        />
      </Field>

      <Field label="Target amount" htmlFor="goal-target" error={errors.target}>
        <input
          id="goal-target"
          name="target"
          type="number"
          inputMode="decimal"
          min="1"
          step="10"
          placeholder="5000"
          className="input tnum"
          required
        />
      </Field>

      <Field
        label="Target date"
        htmlFor="goal-due"
        help="Optional"
        error={errors.dueDate}
      >
        <input id="goal-due" name="dueDate" type="date" className="input" />
      </Field>

      {state?.error ? (
        <Alert tone="danger" className="sm:col-span-2">
          {state.error}
        </Alert>
      ) : null}

      {state?.created ? (
        <Alert tone="success" className="sm:col-span-2">
          Goal created. Add money to it whenever you like.
        </Alert>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          Create goal
        </Button>
      </div>
    </form>
  );
}
