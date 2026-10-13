import type { SVGProps } from "react";

/**
 * The FinLeaf leaf mark.
 *
 * Drawn as an inline SVG rather than a raster asset because it has to stay crisp
 * on the cheap 720p phone screens this product is designed for, and because it
 * has to recolour in dark mode. Three strokes, one fill — no gradients, no
 * embedded font.
 */
export function LeafMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="FinLeaf"
      className={className}
      {...props}
    >
      {/* The leaf body */}
      <path
        d="M27 4C13.5 4 6.5 9.5 5 19.2c-0.2 1.3 0.2 2.3 1 2.4 2.5 0.2 4.4-0.9 5.8-2.4 1.6 1.2 3.6 1.8 5.9 1.8 5.9 0 10.5-4.6 10.5-10.5V4.9C28 4.4 27.6 4 27 4Z"
        fill="currentColor"
      />
      {/* The stamen — the one detail that reads as a leaf rather than a blob */}
      <path
        d="M6.2 20.6 27 5.2"
        stroke="var(--color-surface)"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      {/* The stem */}
      <path
        d="M11 24.6c1.4 2.1 3.3 3 5.8 2.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Wordmark used in the header and footer. */
export function Wordmark({
  className,
  markClassName,
}: {
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <LeafMark className={`h-8 w-8 text-leaf-700 ${markClassName ?? ""}`} />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-bold tracking-tight">FinLeaf</span>
        <span className="text-[0.6875rem] font-medium text-ink-soft">
          Finance with a lighter footprint.
        </span>
      </span>
    </span>
  );
}
