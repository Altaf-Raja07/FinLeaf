import { redirect } from "next/navigation";
import { LeafMark } from "@/components/LeafMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";

/**
 * Sign-in and sign-up, side by side.
 *
 * Both live on one page because users confuse them: someone who has never had
 * an account does not know the difference between "log in" and "register", and
 * putting both in one view removes that decision entirely.
 */
export default async function SignInPage() {
  const { t, locale } = await translator();

  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
      <div className="absolute right-4 top-4">
        <LanguageSwitcher
          activeLocale={locale}
          labels={{ title: t("nav.language"), ariaLabel: t("nav.language") }}
        />
      </div>

      <div className="w-full max-w-5xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <LeafMark className="h-12 w-12 text-leaf-700" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            {t("auth.welcome")}
          </h1>
          <p className="field-help mt-2 max-w-md text-pretty">{t("auth.tagline")}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section
            className="card"
            aria-labelledby="signin-heading"
            aria-describedby="signin-help"
          >
            <h2 id="signin-heading" className="text-lg font-bold tracking-tight">
              {t("auth.welcome")}
            </h2>
            <p id="signin-help" className="field-help mt-1">
              {t("auth.phoneHelp")}
            </p>
            <div className="mt-5">
              <SignInForm locale={locale} />
            </div>
          </section>

          <section
            className="card"
            aria-labelledby="signup-heading"
            aria-describedby="signup-help"
          >
            <h2 id="signup-heading" className="text-lg font-bold tracking-tight">
              {t("auth.welcomeNew")}
            </h2>
            <p id="signup-help" className="field-help mt-1">
              {t("auth.phoneHelp")}
            </p>
            <div className="mt-5">
              <SignUpForm locale={locale} />
            </div>
          </section>
        </div>

        <p className="field-help mt-6 max-w-2xl text-pretty">
          {t("auth.securityBody")}
        </p>
      </div>
    </main>
  );
}
