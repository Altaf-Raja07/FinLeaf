import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { Wordmark } from "@/components/app-shell";
import { Button, Card, Notice } from "@/components/ui";
import { BookIcon, LeafIcon, MicIcon, PiggyIcon, ShieldIcon, TargetIcon } from "@/components/icons";

/**
 * Public landing page.
 *
 * The only screen a signed-out visitor reaches. It explains the two-part mission
 * in the product's own terms and is explicit that this is a simulation, so nobody
 * mistakes it for a bank.
 */

const FEATURES = [
  {
    icon: TargetIcon,
    title: "Trust score, not paperwork",
    body: "We build a 0 to 100 score from how you already use your account, so you can borrow without years of credit history.",
  },
  {
    icon: LeafIcon,
    title: "Your spending's carbon, counted",
    body: "Every payment is estimated by category, so you can see what your money adds up to and spend lighter.",
  },
  {
    icon: MicIcon,
    title: "Speak, don't type",
    body: "Ask for your balance out loud in your own language when reading is not the easiest option.",
  },
];

const STEPS = [
  { n: 1, title: "Open an account in minutes", body: "Three details. No paperwork, no branch visit." },
  { n: 2, title: "Save, transfer and pay bills", body: "Everything you need day to day, in one place." },
  { n: 3, title: "Build trust and unlock a loan", body: "Good habits raise your score over time." },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="min-h-dvh">
      <a href="#main" className="fl-skip-link">
        Skip to main content
      </a>

      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Wordmark />
          <nav aria-label="Main" className="flex items-center gap-3">
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover"
              >
                Open your dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="px-2 text-[14px] font-medium hover:underline">
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-[14px] font-semibold text-white hover:bg-primary-hover"
                >
                  Open an account
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <h1 className="text-[32px] leading-[1.12] font-bold tracking-tight sm:text-[44px]">
              Banking that reaches everyone, and that&apos;s good for the planet
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-muted">
              FinLeaf brings accounts, savings and small loans to people the banking system usually
              overlooks, then shows you what your spending costs the environment and rewards you for
              spending lighter.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="inline-flex h-12 items-center rounded-md bg-primary px-6 text-[15px] font-semibold text-white hover:bg-primary-hover"
              >
                Open an account
              </Link>
              <Link
                href={user ? "/sustainability" : "/login"}
                className="inline-flex h-12 items-center rounded-md border border-border-strong bg-surface px-6 text-[15px] font-semibold hover:bg-sunken"
              >
                See how it works
              </Link>
            </div>
          </div>
        </section>

        {/* Three pillars */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
            <div className="grid gap-4 md:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.title} className="p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft text-primary">
                    <f.icon size={21} />
                  </span>
                  <h2 className="mt-4 text-[17px] font-semibold">{f.title}</h2>
                  <p className="mt-1 text-[14px] text-muted">{f.body}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
          <h2 className="text-[26px] font-bold tracking-tight">How it works</h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n}>
                <Card className="h-full p-5">
                  <span className="fl-num flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-white">
                    {step.n}
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold">{step.title}</h3>
                  <p className="mt-1 text-[14px] text-muted">{step.body}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* Honest framing */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6">
            <div className="flex max-w-3xl flex-col gap-3">
              <h2 className="text-[22px] font-bold tracking-tight">
                This is a demonstration, not a bank
              </h2>
              <p className="text-[15px] text-muted">
                FinLeaf is a student project. Every balance, transfer and loan in it is simulated
                inside a local database. No real bank holds your money, no payment network is
                involved, and the carbon figures are category-based estimates rather than
                measurements.
              </p>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {[
                  "No real credentials, card details, or government ID",
                  "Trust and carbon figures come from models trained on simulated data",
                  "Voice guidance uses your browser's own speech support",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2 text-[14px] text-muted">
                    <ShieldIcon size={17} className="mt-0.5 shrink-0 text-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Notice tone="neutral">
                  Demo account: phone +91 98765 43210, one-time code 123456.
                </Notice>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-6 text-[13px] text-muted sm:px-6">
          <span className="flex items-center gap-2">
            <BookIcon size={16} />
            FinLeaf, a student prototype
          </span>
          <Link href="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </div>
      </footer>
    </div>
  );
}