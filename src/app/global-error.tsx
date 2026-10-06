"use client";

/**
 * Last-resort boundary, for a failure in the root layout itself.
 *
 * This replaces the entire document, so it cannot use the app's CSS classes or any
 * provider. The inline <style> is deliberate: there is no stylesheet to fall back
 * on at this level.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>FinLeaf — something went wrong</title>
        <style>{`
          body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
                 background: #f7f8f6; color: #14261f; display: flex; min-height: 100vh;
                 align-items: center; justify-content: center; padding: 24px; }
          .box { max-width: 26rem; text-align: center; }
          h1 { font-size: 1.5rem; margin: 0 0 8px; }
          p { color: #5b6b64; line-height: 1.5; margin: 0 0 24px; }
          button { width: 100%; height: 48px; border: 0; border-radius: 8px;
                   background: #1f6f4a; color: #fff; font-size: 0.95rem; font-weight: 600;
                   cursor: pointer; }
          button:hover { background: #1a5c3d; }
          .ref { margin-top: 20px; font-size: 0.75rem; color: #7b8a83; }
        `}</style>
      </head>
      <body>
        <div className="box">
          <h1>Something went wrong</h1>
          <p>
            FinLeaf could not start this page. Nothing has been charged or moved. Reloading usually
            resolves it.
          </p>
          <button type="button" onClick={reset}>
            Reload FinLeaf
          </button>
          {error.digest && <p className="ref">Reference {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}