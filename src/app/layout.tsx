import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "FinLeaf",
    template: "%s · FinLeaf",
  },
  description:
    "Digital banking for financial inclusion and low-carbon spending. A simulated prototype.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Zoom is left enabled: pinch-zoom is an accessibility requirement.
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}