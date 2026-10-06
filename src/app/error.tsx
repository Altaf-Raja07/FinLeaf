"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Next renders this in place of a segment that threw during render, so a single
 * failing screen does not take down the whole application. It has to be a client
 * component because it owns state and the reset handler.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is Next's server-side identifier for this render, which is the
    // only way to correlate a user-visible failure with a server log line.
    console.error("[route error]", error.digest ?? "no digest", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <h1 className="text-[26px] font-bold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-[15px] text-muted">
          We could not load this page. Your money and your data are unaffected.
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-12 items-center justify-center rounded-md bg-primary text-[15px] font-semibold text-white hover:bg-primary-hover"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="inline-flex h-12 items-center justify-center rounded-md border border-border-strong text-[15px] font-medium"
          >
            Go to your dashboard
          </a>
        </div>

        {error.digest && (
          <p className="mt-6 text-[12px] text-muted">
            If this keeps happening, quote reference <span className="fl-num">{error.digest}</span>{" "}
            when you contact support.
          </p>
        )}
      </div>
    </main>
  );
}