import type { Metadata, Viewport } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { requestLocale } from "@/lib/locale";

/**
 * Root layout.
 *
 * The `lang` attribute is derived from the user's stored locale preference.
 * A reader using a screen reader or translation extension needs it, and a static
 * hard-coded `en` would mislead both.
 */

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * Plus Jakarta Sans is the site default (see `--font-sans` in `globals.css`):
 * the landing page is designed in it, and every other page is set in it too so
 * the app reads as one thing. It is initialised here, at the root, because
 * `next/font` must be called in a module Next can statically analyse.
 */
const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FinLeaf — Finance with a lighter footprint",
    template: "%s · FinLeaf",
  },
  description:
    "A web-based platform for financial inclusion and carbon-conscious banking: simple, accessible, and honest about what its numbers are.",
  applicationName: "FinLeaf",
  authors: [{ name: "IIIT Dharwad" }],
  keywords: [
    "financial inclusion",
    "carbon footprint",
    "banking",
    "green rewards",
    "trust score",
    "India",
  ],
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1a15" },
  ],
};

/**
 * `instant = false` is required, not optional.
 *
 * The layout reads the locale cookie to set `<html lang>`, which is a
 * request-time API. Under Cache Components that data cannot be prerendered, and
 * a layout cannot be wrapped in `<Suspense>`, so the segment has to declare
 * itself blocking. Without this the build fails on `/_not-found` with
 * "uncached or runtime data during prerendering".
 *
 * This is the correct trade-off rather than a workaround: the language of a page
 * genuinely cannot be known without the request, because the user's preference
 * lives in a cookie rather than the URL. Deferring it would mean shipping `lang`
 * as a guess and correcting it after hydration, which is worse for a screen
 * reader than waiting for the server.
 */
export const instant = false;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await requestLocale();

  return (
    <html
      lang={locale}
      className={`${geistMono.variable} ${jakartaSans.variable} h-full antialiased`}
    >
      <body className="bg-surface text-ink flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
