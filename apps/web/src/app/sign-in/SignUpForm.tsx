"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { requestOtp } from "./otp-actions";
import { registerUser } from "./register-actions";

/**
 * Registration.
 *
 * Two deliberate constraints:
 *
 *  1. The phone number must be proven by OTP before an account exists, so the
 *     user cannot be locked out of an account they did not create.
 *  2. Only four fields are asked for — name, phone, village, password. The
 *     target user is often first-time and low-literacy, and every extra field
 *     is a reason to abandon the form. No government ID, no address pincode,
 *     no date of birth: the platform collects nothing it does not need.
 */

type Stage = "details" | "code";

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  pendingStage?: Stage;
}

const initialState: State = {};

export function SignUpForm({ locale }: { locale: string }) {
  const [state, formAction, pending] = useActionState(registerUser, initialState);
  const [stage, setStage] = useState<Stage>("details");
  const [phone, setPhone] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [codeNotice, setCodeNotice] = useState<string | null>(null);
  const [codePending, setCodePending] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  async function onRequestCode() {
    setCodeError(null);
    setCodeNotice(null);
    setCodePending(true);
    const result = await requestOtp(phone, "REGISTRATION", locale);

    if (result.ok) {
      setStage("code");
      startResendCountdown();
    } else {
      setCodeError(result.message);
    }

    setCodePending(false);
  }

  function startResendCountdown() {
    setResendIn(30);
    const timer = setInterval(() => {
      setResendIn((n) => {
        if (n <= 1) {
          clearInterval(timer);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
  }

  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      {stage === "code" ? (
        <>
          <Alert tone="info" title={`We sent a 6-digit code to ${phone}`}>
            The code expires in 10 minutes and works once.
          </Alert>

          <Field
            label="Verification code"
            htmlFor="signup-code"
            error={codeError ?? undefined}
          >
            <input
              id="signup-code"
              name="otpCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              className="input"
              aria-invalid={codeError ? "true" : undefined}
              required
            />
          </Field>

          <div className="flex items-center justify-between gap-3">
            <Button type="submit" loading={pending}>
              Create account
            </Button>
            {resendIn > 0 ? (
              <span className="field-help">Send the code again in {resendIn}s</span>
            ) : (
              <button
                type="button"
                onClick={onRequestCode}
                className="text-sm font-semibold text-leaf-700 underline"
              >
                Send the code again
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setStage("details")}
            className="self-start text-sm font-semibold text-ink-soft underline"
          >
            Change the number
          </button>
        </>
      ) : (
        <>
          <Field
            label="Your name"
            htmlFor="signup-name"
            error={errors.name}
          >
            <input
              id="signup-name"
              name="name"
              type="text"
              autoComplete="name"
              className="input"
              aria-invalid={errors.name ? "true" : undefined}
              required
              minLength={2}
            />
          </Field>

          <Field
            label="Phone number"
            htmlFor="signup-phone"
            help="Include the country code, e.g. +919876543210"
            error={errors.phone}
          >
            <input
              id="signup-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+919876543210"
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={errors.phone ? "true" : undefined}
              required
            />
          </Field>

          <Field
            label="Village or town"
            htmlFor="signup-village"
            help="Used for your local agent list and leaderboard"
            error={errors.village}
          >
            <input
              id="signup-village"
              name="village"
              type="text"
              autoComplete="address-level2"
              className="input"
              aria-invalid={errors.village ? "true" : undefined}
              required
              minLength={2}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="signup-password"
            help="At least 10 characters, with a lowercase and an uppercase or number"
            error={errors.password}
          >
            <input
              id="signup-password"
              name="password"
              type="password"
              autoComplete="new-password"
              className="input"
              aria-invalid={errors.password ? "true" : undefined}
              required
              minLength={10}
            />
          </Field>

          <Field
            label="Preferred language"
            htmlFor="signup-lang"
            error={errors.preferredLang}
          >
            <select
              id="signup-lang"
              name="preferredLang"
              className="input"
              defaultValue={locale}
            >
              <option value="en">English</option>
              <option value="hi">हिन्दी</option>
              <option value="kn">ಕನ್ನಡ</option>
            </select>
          </Field>

          {state?.error && !Object.keys(errors).length ? (
            <Alert tone="danger" title="Could not create the account">
              {state.error}
            </Alert>
          ) : null}

          <Button
            type="button"
            onClick={onRequestCode}
            loading={codePending}
            disabled={phone.length < 8}
          >
            Send code
          </Button>

          <p className="field-help">
            FinLeaf will never ask for your one-time code, your PIN or your
            password. Anyone who does is attempting fraud.
          </p>
        </>
      )}

      {codeNotice ? <Alert tone="info">{codeNotice}</Alert> : null}
    </form>
  );
}
