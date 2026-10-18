"use client";

import { useActionState } from "react";
import { Button, Field, Alert } from "@/components/ui";
import { passwordLogin } from "./otp-actions";
import { translate, type Locale } from "@/lib/i18n";
import { Phone, Lock } from "lucide-react";

/**
 * Modern, OTP-free direct Sign-in form.
 */
export function SignInForm({
  locale,
  onSwitchToRegister,
}: {
  locale: string;
  onSwitchToRegister?: () => void;
}) {
  const [state, formAction, pending] = useActionState(passwordLogin, {});

  const loc = (locale as Locale) || "en";
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(loc, key, vars);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />

      <Field
        label={t("auth.phone")}
        htmlFor="signin-phone"
        help={t("auth.phoneHelp")}
      >
        <div className="relative">
          <input
            id="signin-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+919876543210"
            className="input pl-10"
            required
          />
          <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-faint pointer-events-none" />
        </div>
      </Field>

      <Field label={t("auth.password")} htmlFor="signin-password">
        <div className="relative">
          <input
            id="signin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••••••"
            className="input pl-10"
            required
          />
          <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-faint pointer-events-none" />
        </div>
      </Field>

      {state?.error ? (
        <Alert tone="danger" title={t("auth.signInFailed")}>
          {state.error}
        </Alert>
      ) : null}

      <Button type="submit" loading={pending} className="w-full py-3 text-base font-semibold shadow-md">
        {pending ? t("auth.processing") : t("auth.welcome")}
      </Button>

      {onSwitchToRegister ? (
        <div className="text-center pt-2">
          <p className="text-sm text-ink-soft">
            {t("auth.noAccount")}{" "}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="font-bold text-leaf-700 hover:text-leaf-800 underline transition-colors cursor-pointer"
            >
              {t("auth.welcomeNew")}
            </button>
          </p>
        </div>
      ) : null}
    </form>
  );
}
