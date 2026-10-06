import Image from "next/image";

/**
 * Application illustrations.
 *
 * Every asset is a local WebP generated for this project, sized to where it is
 * displayed. Wrapped in one component so the alt text, lazy loading, and sizing
 * rules live in a single place rather than being re-decided per call site.
 *
 * Alt text is required and descriptive: these images carry meaning for users who
 * cannot rely on reading, so a decorative role would be wrong.
 */

export type AssetKey =
  | "hero-illustration"
  | "empty-transactions"
  | "empty-goals"
  | "empty-rewards"
  | "lesson-savings-safe"
  | "lesson-on-time-bills"
  | "lesson-trust-score"
  | "auth-welcome"
  | "agent-kiosk"
  | "voice-assistant";

/** Matches the alt text recorded alongside each generated asset. */
const ALT: Record<AssetKey, string> = {
  "hero-illustration":
    "A shopkeeper counting money for a customer at a village shop, with a bus at a stop behind them, a schoolboy walking past, and leaves and a tree growing beside the shop",
  "empty-transactions": "A neat stack of paper receipts held with a clip, with a small leaf on top",
  "empty-goals": "A glass savings jar with coins dropping in and a small green sprout growing from the top",
  "empty-rewards": "Two cupped hands holding a small growing sapling, with a soft rising sun behind it",
  "lesson-savings-safe": "A closed padlock resting on top of a rounded piggy bank, with coins beside it",
  "lesson-on-time-bills": "A wall calendar with a tick beside one date, and a paid receipt in front of it",
  "lesson-trust-score":
    "An upward-trending line chart with a leaf growing from its highest point, and two small figures looking at it",
  "auth-welcome": "A welcoming open doorway with warm light spilling out, a potted plant beside it, framed by large leaves",
  "agent-kiosk":
    "A small village banking kiosk with a person behind the counter and a customer in front, with a bus stop pole nearby",
  "voice-assistant": "A person speaking, with soft curved sound-wave arcs radiating towards a stylised leaf",
};

/** Lesson thumbnails, keyed by the lesson slug that uses them. */
export const LESSON_ASSET: Record<string, AssetKey> = {
  "keeping-savings-safe": "lesson-savings-safe",
  "on-time-bills": "lesson-on-time-bills",
  "understanding-trust-score": "lesson-trust-score",
};

export function Asset({
  name,
  width,
  height,
  priority = false,
  className = "",
  sizes,
}: {
  name: AssetKey;
  /** Intrinsic width in CSS pixels, used to reserve layout space. */
  width: number;
  height: number;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  return (
    <Image
      src={`/assets/${name}.webp`}
      alt={ALT[name]}
      width={width}
      height={height}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      sizes={sizes}
      className={className}
    />
  );
}

/** Illustration for an empty state, sized for the shared EmptyState component. */
export function EmptyStateArt({ name, size = 150 }: { name: AssetKey; size?: number }) {
  return (
    <div
      className="mx-auto mb-1 flex items-center justify-center"
      style={{ width: size, height: size * 0.78 }}
    >
      <Asset
        name={name}
        width={size * 2}
        height={Math.round(size * 0.78 * 2)}
        sizes={`${size}px`}
        className="h-full w-auto"
      />
    </div>
  );
}