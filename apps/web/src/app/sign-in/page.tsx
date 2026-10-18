import Link from "next/link";
import { redirect } from "next/navigation";
import { LeafMark } from "@/components/LeafMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AuthCard } from "./AuthCard";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { ArrowLeft, ShieldCheck } from "lucide-react";

/**
 * Modern, beautiful authentication page.
 * Provides instant sign-in and account registration without OTP delays.
 */
export default async function SignInPage() {
  const { t, locale } = await translator();

  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative min-h-dvh flex flex-col items-center justify-center px-4 py-12">
      {/* Ambient background decoration */}
      <div className="absolute inset-0 -z-10 flex items-center justify-center overflow-hidden pointer-events-none">
        <div className="h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-leaf-400/15 to-emerald-300/10 blur-3xl" />
      </div>

      {/* Top Bar with Home link & Language switcher */}
      <div className="w-full max-w-md flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink transition-colors no-underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{t("nav.badgeHome")}</span>
        </Link>
        <LanguageSwitcher
          activeLocale={locale}
          labels={{ title: t("nav.language"), ariaLabel: t("nav.language") }}
        />
      </div>

      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo & Headline */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href="/" className="no-underline flex items-center gap-2.5">
            <LeafMark className="h-10 w-10 text-leaf-700" />
            <span className="text-2xl font-bold tracking-tight">FinLeaf</span>
          </Link>
          <p className="field-help mt-2 text-pretty">{t("auth.tagline")}</p>
        </div>

        {/* The Auth Card with Sign In / Register tabs */}
        <div className="w-full">
          <AuthCard locale={locale} />
        </div>

        {/* Security badge note */}
        <div className="mt-8 flex items-center gap-2 text-xs text-ink-faint max-w-sm text-center">
          <ShieldCheck className="h-4 w-4 text-leaf-600 shrink-0" />
          <span>{t("auth.securityBody")}</span>
        </div>
      </div>
    </main>
  );
}
