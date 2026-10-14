"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { changePasswordAction } from "./profile-actions";

/**
 * Change password.
 *
 * Requires the current password, so a stolen session cookie is not enough to
 * take over an account permanently. The action also revokes every existing
 * session, including this one — which means the form visibly fails to a signed-in
 * UI afterwards unless it re-authenticates.
 *
 * To avoid that, the action takes over the form and redirects to sign-in with a
 * message. That is the honest version of "sign out everywhere".
 */

interface State {
  error?: string;
  message?: string;
}

const initialState: State = {};

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <Field label="Current password" htmlFor="current-password">
        <input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          className="input"
          required
        />
      </Field>

      <Field
        label="New password"
        htmlFor="new-password"
        help="At least 10 characters, with a lowercase and an uppercase or number"
      >
        <input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          className="input"
          required
          minLength={10}
        />
      </Field>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <p className="field-help">
        Changing your password signs you out of every device, including this one.
      </p>

      <Button type="submit" loading={pending}>
        Change password
      </Button>
    </form>
  );
}
