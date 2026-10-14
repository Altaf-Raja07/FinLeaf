"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { createCircleAction } from "./circle-action";

/**
 * Start a circle.
 *
 * The village is pre-filled from the signed-in user's own profile and left
 * editable, because a circle occasionally spans two neighbouring hamlets that
 * the account records as one village. It defaults rather than starting blank so
 * the common case is a name and a tap.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

const initialState: State = {};

export function CreateCircleForm({
  defaultVillage,
  labels,
}: {
  defaultVillage: string;
  labels: {
    name: string;
    namePlaceholder: string;
    village: string;
    submit: string;
  };
}) {
  const [state, formAction, pending] = useActionState(createCircleAction, initialState);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field
        label={labels.name}
        htmlFor="circle-name"
        error={errors.name}
        className="sm:col-span-2"
      >
        <input
          id="circle-name"
          name="name"
          type="text"
          maxLength={80}
          minLength={2}
          required
          placeholder={labels.namePlaceholder}
          className="input"
        />
      </Field>

      <Field label={labels.village} htmlFor="circle-village" error={errors.village}>
        <input
          id="circle-village"
          name="village"
          type="text"
          maxLength={80}
          minLength={2}
          required
          defaultValue={defaultVillage}
          className="input"
        />
      </Field>

      {state?.error ? (
        <Alert tone="danger" className="sm:col-span-2">
          {state.error}
        </Alert>
      ) : null}

      {state?.message ? (
        <Alert tone="success" className="sm:col-span-2">
          {state.message}
        </Alert>
      ) : null}

      <div className="sm:col-span-2">
        <Button type="submit" loading={pending}>
          {labels.submit}
        </Button>
      </div>
    </form>
  );
}
