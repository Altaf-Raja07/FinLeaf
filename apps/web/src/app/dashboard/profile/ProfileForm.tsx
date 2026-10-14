"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import { updateProfileAction } from "./profile-actions";

/**
 * Profile form.
 *
 * A Client Component only because it needs `useActionState` to render validation
 * errors without a page navigation; the page it sits on is a Server Component.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

const initialState: State = {};

export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    phone: string;
    village: string;
    email: string;
    preferredLang: Locale;
  };
}) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <Field label="Your name" htmlFor="profile-name" error={errors.name}>
        <input
          id="profile-name"
          name="name"
          type="text"
          defaultValue={initial.name}
          maxLength={80}
          className="input"
          required
          minLength={2}
        />
      </Field>

      <Field label="Phone number" htmlFor="profile-phone">
        {/* The phone number identifies the account, so it is not editable text.
            Changing it is a verified flow of its own — an OTP to the new
            number — and presenting it as an editable field would imply the
            change takes effect without that proof. */}
        <input
          id="profile-phone"
          name="phone"
          type="tel"
          defaultValue={initial.phone}
          className="input"
          disabled
        />
      </Field>

      <Field label="Village or town" htmlFor="profile-village" error={errors.village}>
        <input
          id="profile-village"
          name="village"
          type="text"
          defaultValue={initial.village}
          maxLength={80}
          className="input"
          required
          minLength={2}
        />
      </Field>

      <Field label="Email" help="Optional" htmlFor="profile-email" error={errors.email}>
        <input
          id="profile-email"
          name="email"
          type="email"
          defaultValue={initial.email}
          className="input"
        />
      </Field>

      <Field label="Preferred language" htmlFor="profile-lang" className="sm:col-span-2">
        <select
          id="profile-lang"
          name="preferredLang"
          className="input"
          defaultValue={initial.preferredLang}
        >
          {LOCALES.map((code) => (
            <option key={code} value={code}>
              {LOCALE_NAMES[code]}
            </option>
          ))}
        </select>
      </Field>

      {state?.error && !Object.keys(errors).length ? (
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
          Save changes
        </Button>
      </div>
    </form>
  );
}
