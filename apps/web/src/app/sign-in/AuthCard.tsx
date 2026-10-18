"use client";

import { useState } from "react";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { translate, type Locale } from "@/lib/i18n";

export function AuthCard({ locale }: { locale: string }) {
  const [activeTab, setActiveTab] = useState<"signin" | "signup">("signin");
  const loc = (locale as Locale) || "en";
  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(loc, key, vars);

  return (
    <div className="card shadow-2xl border border-rule/80 bg-surface-raised rounded-3xl p-6 sm:p-8">
      {/* Modern Segmented Tab Switcher */}
      <div className="flex p-1.5 mb-6 rounded-2xl bg-surface-sunken border border-rule">
        <button
          type="button"
          onClick={() => setActiveTab("signin")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl cursor-pointer transition-[background-color,color,box-shadow,border-color] duration-150 ${
            activeTab === "signin"
              ? "bg-surface-raised text-ink shadow-sm border border-rule/50"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          {t("auth.welcome")}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("signup")}
          className={`flex-1 py-2.5 text-sm font-bold rounded-xl cursor-pointer transition-[background-color,color,box-shadow,border-color] duration-150 ${
            activeTab === "signup"
              ? "bg-surface-raised text-ink shadow-sm border border-rule/50"
              : "text-ink-soft hover:text-ink"
          }`}
        >
          {t("auth.welcomeNew")}
        </button>
      </div>

      {activeTab === "signin" ? (
        <SignInForm
          locale={locale}
          onSwitchToRegister={() => setActiveTab("signup")}
        />
      ) : (
        <SignUpForm
          locale={locale}
          onSwitchToSignIn={() => setActiveTab("signin")}
        />
      )}
    </div>
  );
}
