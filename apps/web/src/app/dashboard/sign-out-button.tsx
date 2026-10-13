"use client";

import { LogOut } from "lucide-react";
import { signOut } from "./sign-out-action";

/**
 * Sign-out control.
 *
 * A Client Component only because `signOut()` is a Server Action that changes
 * the cookie and redirects; calling it from a server component's onClick is not
 * possible.
 */
export function SignOutButton({ label }: { label: string }) {
  return (
    <form action={signOut}>
      <button type="submit" className="btn btn-secondary">
        <LogOut className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}
