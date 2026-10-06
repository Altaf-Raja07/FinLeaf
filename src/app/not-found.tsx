import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <p className="fl-num text-[13px] font-semibold text-muted">404</p>
        <h1 className="mt-1 text-[26px] font-bold tracking-tight">We could not find that page</h1>
        <p className="mt-2 text-[15px] text-muted">
          The link may be out of date, or the page may have moved.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary text-[15px] font-semibold text-white hover:bg-primary-hover"
          >
            Go to your dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border-strong text-[15px] font-medium"
          >
            FinLeaf home
          </Link>
        </div>
      </div>
    </main>
  );
}