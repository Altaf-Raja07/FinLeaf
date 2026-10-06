/**
 * Site-level constants.
 *
 * Kept in one place so the canonical URL has a single definition. It matters for
 * more than tidiness: Open Graph and sitemap URLs must be absolute, and deriving
 * them from the incoming request would let a Host header decide what the site
 * claims to be.
 */
export const APP_NAME = "FinLeaf";
export const APP_TAGLINE = "Banking that works for everyone";

export const APP_DESCRIPTION =
  "A low-carbon digital bank for people the traditional system leaves out. Track what you spend, " +
  "what it costs the planet, and whether a loan is affordable before you sign for it.";

/**
 * The public origin.
 *
 * Falls back to the local development address. In production NEXT_PUBLIC_APP_URL
 * must be set; a deployment with a wrong canonical URL would poison search results
 * and social previews in a way that is slow to notice and slow to undo.
 */
export const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const SUPPORT_PHONE = "1800 123 4567";

export const ORGANISATION = {
  name: APP_NAME,
  legalName: "FinLeaf Financial Services",
  // A real deployment would carry a registered address and contact details here.
  address: { addressLocality: "Bengaluru", addressRegion: "Karnataka", addressCountry: "IN" },
} as const;

/**
 * Environment label shown in the interface.
 *
 * The product moves no real money, so the interface says which environment the user
 * is in rather than implying a live account. It is one line in the footer, not a
 * banner on every screen: this is a sandbox, and saying so once, plainly, is more
 * useful than repeating it until it reads as marketing copy.
 */
export const ENVIRONMENT_LABEL =
  process.env.NEXT_PUBLIC_ENVIRONMENT_LABEL ?? "Sandbox environment";