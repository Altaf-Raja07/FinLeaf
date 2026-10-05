/**
 * Phone number normalisation.
 *
 * A user typing "+91 98765 43210" and a row storing "+919876543210" are the same
 * person. Without normalisation those are two different strings, so sign-in
 * silently fails for anyone who formats their number.
 *
 * Canonical form: digits only, with a leading "+" and the country code. Anything
 * else - spaces, dashes, parentheses, dots - is stripped before comparison.
 */

export function normalisePhone(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  // Keep a leading + if present, drop everything that is not a digit.
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");

  if (!digits) return "";
  // An 11-digit number is an Indian mobile without the country code.
  if (!hasPlus && digits.length === 10) return `+91${digits}`;
  return hasPlus ? `+${digits}` : digits;
}

/** Pretty form for display: +91 98765 43210. */
export function formatPhone(canonical: string): string {
  if (canonical.startsWith("+91") && canonical.length === 13) {
    return `+91 ${canonical.slice(3, 8)} ${canonical.slice(8)}`;
  }
  return canonical;
}

/** Human-facing validation message, or null when the number looks usable. */
export function validatePhone(input: string): string | null {
  const canonical = normalisePhone(input);
  if (!canonical) return "Enter a phone number.";
  const digits = canonical.replace(/\D/g, "");
  if (digits.length < 6) return "That phone number is too short.";
  if (digits.length > 15) return "That phone number is too long.";
  return null;
}