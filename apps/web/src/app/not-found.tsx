import Link from "next/link";
import { LeafMark } from "@/components/LeafMark";

/**
 * Not-found page.
 *
 * Written to be useful rather than merely apologetic: it says what happened and
 * offers the two destinations that matter — the home page and, if the visitor is
 * signed in, their dashboard.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <LeafMark className="h-12 w-12 text-leaf-700" />

      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>

      <p className="field-help text-pretty">
        The page you were looking for does not exist, or it has moved. Check the
        address and try again.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn btn-primary no-underline">
          Go to the home page
        </Link>
        <Link href="/sign-in" className="btn btn-secondary no-underline">
          Sign in
        </Link>
      </div>
    </main>
  );
}
