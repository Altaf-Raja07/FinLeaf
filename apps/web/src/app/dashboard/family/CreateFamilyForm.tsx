"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { createFamilyGroupAction } from "./family-action";

/**
 * Create a family group.
 *
 * A name is all that is asked for. A group without members is still useful — it
 * is where the owner starts — so the form never requires an invitee to complete.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

const initialState: State = {};

export function CreateFamilyForm({ labels }: { labels: { name: string; submit: string } }) {
  const [state, formAction, pending] = useActionState(createFamilyGroupAction, initialState);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <Field
        label={labels.name}
        htmlFor="family-name"
        error={errors.name}
        className="min-w-56 flex-1"
      >
        <input
          id="family-name"
          name="name"
          type="text"
          maxLength={80}
          minLength={2}
          required
          placeholder="Home"
          className="input"
        />
      </Field>

      <Button type="submit" loading={pending}>
        {labels.submit}
      </Button>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}
    </form>
  );
}
