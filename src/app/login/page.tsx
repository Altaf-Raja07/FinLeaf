import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Button, Field, Input, Notice } from "@/components/ui";
import { LeafIcon, LockIcon, PhoneIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Sign-in page.
 *
 * Two steps on one screen, matching design/login.png: phone number, then a demo
 * OTP. There is no SMS provider, so the expected code is shown on screen and the
 * page never claims a message was sent.
 */

interface SearchParams {
  step?: string;
  phone?: string;
  error?: string;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const step = params.step === "otp" ? "otp" : "phone";
  const phone = params.phone ?? "";
  const error = params.error;
  const demoOtp = process.env.DEMO_OTP ?? "123456";

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="text-primary">
            <LeafIcon size={34} />
          </span>
          <h1 className="mt-2 text-[26px] font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-[15px] text-muted">Sign in to your FinLeaf account</p>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6">
          {step === "phone" ? (
            <form action="/api/auth/start" method="post" className="flex flex-col gap-4">
              <Field label="Phone number" htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+91 98765 43210"
                  defaultValue={phone}
                  required
                />
              </Field>

              {error && <p className="text-[13px] font-medium text-danger">{error}</p>}

              <Button type="submit" size="lg" className="w-full">
                Send one-time password
              </Button>

              <p className="text-center text-[13px] text-muted">
                New to FinLeaf?{" "}
                <Link href="/signup" className="font-medium text-primary">
                  Create an account
                </Link>
              </p>
            </form>
          ) : (
            <form action="/api/auth/verify" method="post" className="flex flex-col gap-4">
              <input type="hidden" name="phone" value={phone} />

              <Field label="One-time password" htmlFor="otp" hint={`Demo code is ${demoOtp}`}>
                <Input
                  id="otp"
                  name="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  required
                  className="fl-num tracking-[0.3em]"
                />
              </Field>

              <Notice tone="neutral">
                This prototype has no SMS provider. Use the demo code shown above; no message was
                sent.
              </Notice>

              {error && <p className="text-[13px] font-medium text-danger">{error}</p>}

              <Button type="submit" size="lg" className="w-full">
                Sign in
              </Button>

              <p className="text-center text-[13px]">
                <Link
                  href="/login"
                  className="font-medium text-primary"
                >
                  Use a different number
                </Link>
              </p>
            </form>
          )}
        </div>

        <div className="mt-4 flex flex-col items-center gap-1.5 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <LockIcon size={15} />
            Simulated prototype. No real money moves.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PhoneIcon size={15} />
            Demo user: +91 98765 43210
          </span>
        </div>
      </div>
    </main>
  );
}