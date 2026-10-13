"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Alert } from "@/components/ui";
import { requestOtp } from "./otp-actions";
import { verifyOtpCode } from "./otp-actions";
import { passwordLogin, otpLogin } from "./otp-actions";
import { Spinner } from "@/components/ui";

type Method = "password" | "otp";

interface State {
  error?: string;
  codeSent?: boolean;
  notice?: string;
  method?: Method;
}

const initialState: State = { method: "password" };

/**
 * Sign-in form.
 *
 * The password path is the default. A separate OTP path exists for a user who
 * has never set a password, and switching to it re-uses the same phone field
 * rather than asking for the number twice.
 */
export function SignInForm({ locale }: { locale: string }) {
  const [state, formAction, pending] = useActionState(passwordLogin, initialState);
  const [otpState, otpAction, otpPending] = useActionState(otpLogin, initialState);
  const [method, setMethod] = useState<Method>("password");
  const [phone, setPhone] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const router = useRouter();

  async function onSendCode() {
    setNotice(null);
    const result = await requestOtp(phone, "LOGIN", locale);
    if (result.ok) setCodeSent(true);
    else setNotice(result.message);
  }

  async function onVerifyCode(code: string) {
    setNotice(null);
    const result = await verifyOtpCode(phone, "LOGIN", code, locale);
    if (result.ok) router.push("/dashboard");
    else setNotice(result.message);
  }

  // --- OTP path ----------------------------------------------------------
  if (method === "otp") {
    return (
      <form action={otpAction} className="flex flex-col gap-4">
        {!codeSent ? (
          <div className="flex flex-col gap-4">
            <Field label="Phone" htmlFor="otp-phone" help="Include the country code, e.g. +919876543210">
              <input
                id="otp-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+919876543210"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </Field>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setMethod("password")}>
                Back
              </Button>
              <Button type="button" onClick={onSendCode} disabled={phone.length < 8}>
                Send code
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Alert tone="info">
              We sent a 6-digit code to {phone}
            </Alert>
            <Field label="Verification code" htmlFor="otp-code">
              <input
                id="otp-code"
                name="otpCode"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="one-time-code"
                maxLength={6}
                className="input"
                required
              />
            </Field>
            <Button type="submit" loading={otpPending}>
              Verify
            </Button>
          </div>
        )}
        {notice ? <Alert tone="danger" title="Sign in failed">{notice}</Alert> : null}
        {otpState?.error ? (
          <Alert tone="danger" title="Sign in failed">{otpState.error}</Alert>
        ) : null}
      </form>
    );
  }

  // --- Password path (default) -------------------------------------------
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field label="Phone" htmlFor="signin-phone" help="Include the country code, e.g. +919876543210">
        <input
          id="signin-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+919876543210"
          className="input"
          required
        />
      </Field>

      <Field label="Password" htmlFor="signin-password">
        <input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="input"
          required
        />
      </Field>

      {state?.error ? (
        <Alert tone="danger" title="Sign in failed">{state.error}</Alert>
      ) : null}

      <Button type="submit" loading={pending}>
        Sign in
      </Button>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMethod("otp")}
          className="text-sm font-semibold text-leaf-700 underline"
        >
          Sign in with a code instead
        </button>
      </div>
    </form>
  );
}
