"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { SpeakButton } from "@/components/SpeakButton";
import { registerUser } from "./register-actions";
import { translate, type Locale } from "@/lib/i18n";
import { User, Phone, MapPin, Lock, Globe } from "lucide-react";

/**
 * Modern, OTP-free instant registration form.
 * Directly creates the account and logs the user in.
 */
export function SignUpForm({
  locale,
  onSwitchToSignIn,
}: {
  locale: string;
  onSwitchToSignIn?: () => void;
}) {
  const [state, formAction, pending] = useActionState(registerUser, {});

  const loc = (locale as Locale) || "en";
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(loc, key, vars);

  const errors = state?.fieldErrors ?? {};

  const voiceGuidance = `${t("auth.enterName")}. ${t("auth.enterPhone")}. ${t("auth.enterVillage")}. ${t("auth.enterPassword")}.`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="flex items-center justify-between rounded-xl bg-leaf-50/80 px-3 py-2 border border-leaf-200/60">
        <span className="text-xs font-medium text-leaf-800">{t("auth.voiceHelp")}</span>
        <SpeakButton locale={loc} text={voiceGuidance} variant="secondary" />
      </div>

      <Field
        label={t("auth.name")}
        htmlFor="signup-name"
        error={errors.name}
      >
        <div className="relative">
          <input
            id="signup-name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Aarav Sharma"
            className="input pl-10"
            aria-invalid={errors.name ? "true" : undefined}
            required
            minLength={2}
          />
          <User className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-faint pointer-events-none" />
        </div>
      </Field>

      <Field
        label={t("auth.phone")}
        htmlFor="signup-phone"
        help={t("auth.phoneHelp")}
        error={errors.phone}
      >
        <div className="relative">
          <input
            id="signup-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+919876543210"
            className="input pl-10"
            aria-invalid={errors.phone ? "true" : undefined}
            required
          />
          <Phone className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-faint pointer-events-none" />
        </div>
      </Field>

      <Field
        label={t("auth.village")}
        htmlFor="signup-village"
        help={t("auth.villageHelp")}
        error={errors.village}
      >
        <div className="relative">
          <input
            id="signup-village"
            name="village"
            type="text"
            autoComplete="address-level2"
            placeholder="Dharwad"
            className="input pl-10"
            aria-invalid={errors.village ? "true" : undefined}
            required
            minLength={2}
          />
          <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-faint pointer-events-none" />
        </div>
      </Field>

      <Field
        label={t("auth.password")}
        htmlFor="signup-password"
        help={t("auth.passwordHelp")}
        error={errors.password}
      >
        <div className="relative">
          <input
            id="signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            className="input pl-10"
            aria-invalid={errors.password ? "true" : undefined}
            required
            minLength={10}
          />
          <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-faint pointer-events-none" />
        </div>
      </Field>

      <Field
        label={t("auth.preferredLanguage")}
        htmlFor="signup-lang"
        error={errors.preferredLang}
      >
        <div className="relative">
          <select
            id="signup-lang"
            name="preferredLang"
            className="input pl-10 appearance-none bg-surface-raised cursor-pointer"
            defaultValue={locale}
          >
            <option value="en">English (India)</option>
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="kn">ಕನ್ನಡ (Kannada)</option>
          </select>
          <Globe className="absolute left-3.5 top-3.5 h-4 w-4 text-ink-faint pointer-events-none" />
        </div>
      </Field>

      {state?.error && !Object.keys(errors).length ? (
        <Alert tone="danger" title={t("auth.signUpFailed")}>
          {state.error}
        </Alert>
      ) : null}

      <Button
        type="submit"
        loading={pending}
        className="w-full py-3 text-base font-semibold shadow-md mt-1"
      >
        {pending ? t("auth.processing") : t("auth.createAccount")}
      </Button>

      {onSwitchToSignIn ? (
        <div className="text-center pt-2">
          <p className="text-sm text-ink-soft">
            {t("auth.haveAccount")}{" "}
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="font-bold text-leaf-700 hover:text-leaf-800 underline transition-colors cursor-pointer"
            >
              {t("auth.welcome")}
            </button>
          </p>
        </div>
      ) : null}
    </form>
  );
}
