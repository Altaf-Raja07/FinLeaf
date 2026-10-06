import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Asset } from "@/components/illustration";
import { Card, Field, Input, Notice, Select } from "@/components/ui";
import { LeafIcon, LockIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Registration: three fields and you are in.
 *
 * The small field count is the inclusion requirement, not an omission. The note
 * below the form states plainly that no bank, card, or government identifier is
 * ever asked for.
 */

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-[880px] items-center gap-10 lg:grid-cols-[minmax(0,430px)_1fr]">
        <div className="w-full">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="text-primary">
              <LeafIcon size={32} />
            </span>
            <h1 className="mt-2 text-[26px] font-bold tracking-tight">Create your account</h1>
            <p className="mt-1 text-[15px] text-muted">
              It takes about two minutes. Only three details needed.
            </p>
          </div>

          <Card className="p-6">
            <form action="/api/auth/register" method="post" className="flex flex-col gap-4">
              <Field label="Full name" htmlFor="fullName">
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Ravi Kumar"
                />
              </Field>

              <Field label="Phone number" htmlFor="phone">
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  required
                  placeholder="+91 98765 43210"
                />
              </Field>

              <Field label="Primary language" htmlFor="language">
                <Select id="language" name="language" defaultValue="en">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="kn">Kannada</option>
                </Select>
              </Field>

              {error && (
                <p role="alert" className="text-[13px] font-medium text-danger">
                  {error}
                </p>
              )}

              <Notice tone="neutral">
                We never ask for a bank account number, card details, or a government ID number.
              </Notice>

              <button
                type="submit"
                className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary text-[15px] font-semibold text-white hover:bg-primary-hover"
              >
                Create account
              </button>

              <p className="text-center text-[13px] text-muted">
                Already have one?{" "}
                <Link href="/login" className="font-medium text-primary">
                  Sign in
                </Link>
              </p>
            </form>
          </Card>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[13px] text-muted">
            <LockIcon size={15} />
            Demo accounts share one password, so nobody needs credentials for this project.
          </div>
        </div>

        <div className="hidden lg:block">
          <Asset
            name="auth-welcome"
            width={560}
            height={747}
            priority
            sizes="(min-width: 1024px) 360px, 0px"
            className="w-full"
          />
        </div>
      </div>
    </main>
  );
}