/**
 * Route-level loading state.
 *
 * Every screen reads several queries before it can render, so this is what a user
 * sees during that window. It mirrors the app shell's geometry — same page width,
 * same card shape — so the transition into real content does not shift the layout
 * under them.
 *
 * aria-busy tells assistive technology the region is still settling, and the
 * visually hidden text says what is happening rather than leaving a silent pause.
 */
export default function Loading() {
  return (
    <main className="min-h-dvh" aria-busy="true" aria-live="polite">
      <span className="fl-sr-only">Loading your account…</span>

      <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6">
        {/* Title placeholder. */}
        <div className="mb-6 flex flex-col gap-2">
          <div className="h-8 w-56 animate-pulse rounded-md bg-sunken" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-sunken/70" />
        </div>

        {/* Summary row. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-5">
              <div className="h-3.5 w-24 animate-pulse rounded bg-sunken" />
              <div className="mt-3 h-7 w-32 animate-pulse rounded bg-sunken" />
              <div className="mt-3 h-3 w-40 animate-pulse rounded bg-sunken/60" />
            </div>
          ))}
        </div>

        {/* Content block. */}
        <div className="mt-4 rounded-lg border border-border bg-surface p-5">
          <div className="h-4 w-44 animate-pulse rounded bg-sunken" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-sunken" />
                <div className="h-3.5 flex-1 animate-pulse rounded bg-sunken/70" />
                <div className="h-3.5 w-20 shrink-0 animate-pulse rounded bg-sunken/70" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}