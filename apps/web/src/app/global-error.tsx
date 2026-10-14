"use client";

import { useEffect } from "react";
import { LeafMark } from "@/components/LeafMark";

/**
 * Global error boundary.
 *
 * Only reachable for an error in the root layout itself, which is why it has to
 * render its own document. The reset is offered rather than automatic: an
 * automatic reload on a persistent failure traps the user in a loop.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The console line carries the digest, which is what makes server-side log
    // correlation possible for a client-side crash.
    console.error("finleaf: uncaught application error", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-5 bg-surface px-4 text-center">
        <LeafMark className="h-12 w-12 text-leaf-700" />

        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>

        <p className="max-w-md text-sm leading-relaxed text-ink-soft text-pretty">
          This is a problem on our side, not something you did. You can try
          again, and if it keeps happening the reference below helps us find it.
        </p>

        {error.digest ? (
          <code className="rounded-lg bg-surface-sunken px-2 py-1 font-mono text-xs">
            {error.digest}
          </code>
        ) : null}

        <div className="flex flex-wrap justify-center gap-3">
          <button type="button" onClick={reset} className="btn btn-primary">
            Try again
          </button>
          <a href="/" className="btn btn-secondary no-underline">
            Go to the home page
          </a>
        </div>
      </body>
    </html>
  );
}
