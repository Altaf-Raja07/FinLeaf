"use client";

import {
  Award,
  BookOpen,
  GraduationCap,
  Leaf,
  Library,
  PiggyBank,
  Repeat,
  Send,
  Shield,
  Sparkles,
  Sprout,
  Target,
  Trophy,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Badge icons.
 *
 * `data/badges.json` names an icon per badge, and this is the one place that
 * maps those names to components. An unknown name falls back to a neutral icon
 * rather than rendering nothing: a missing icon should be visible as a
 * placeholder, not silently leave a blank space nobody notices.
 */

const ICONS: Record<string, ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  "book-open-check": BookOpen,
  "graduation-cap": GraduationCap,
  library: Library,
  "piggy-bank": PiggyBank,
  target: Target,
  sparkles: Sparkles,
  send: Send,
  repeat: Repeat,
  "shield-check": Shield,
  sprout: Sprout,
  leaf: Leaf,
  trophy: Trophy,
  award: Award,
};

export function BadgeIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICONS[name] ?? Award;

  return <Icon className={className} aria-hidden />;
}
