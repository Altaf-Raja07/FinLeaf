"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCo2e, formatMoney, type Locale } from "@/lib/i18n";
import { EmptyState } from "@/components/ui";

/**
 * Which kinds of spending carry the most estimated carbon.
 *
 * Colour encodes nothing here — every bar is the same green, because a colour
 * ramp over an estimate would imply precision that does not exist and would be
 * unreadable with red-green colour vision deficiency.
 */
export function CategoryChart({
  data,
  locale,
}: {
  data: Array<{ category: string; co2eKg: number; spend: number; count: number }>;
  locale: Locale;
}) {
  if (data.length === 0) {
    return <EmptyState title="No spending recorded yet" />;
  }

  const rows = data.map((d) => ({
    category: d.category.split("_").map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(" "),
    co2eKg: d.co2eKg,
    spend: d.spend,
  }));

  return (
    <div
      className="h-56 w-full"
      role="img"
      aria-label={`Estimated carbon by category: ${rows
        .map((r) => `${r.category} ${formatCo2e(r.co2eKg, locale)}`)
        .join(", ")}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" horizontal={false} />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 11, fill: "var(--color-ink-faint)" }}
            axisLine={{ stroke: "var(--color-rule)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--color-ink-faint)" }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(value) => [formatCo2e(Number(value), locale), "Estimated CO₂e"]}
            labelFormatter={(label) => `Spent ${formatMoney(rows.find((r) => r.category === label)?.spend ?? 0)}`}
            contentStyle={{
              borderRadius: "0.75rem",
              border: "1px solid var(--color-rule)",
              background: "var(--color-surface-raised)",
              fontSize: "0.8125rem",
            }}
          />
          <Bar dataKey="co2eKg" radius={[6, 6, 0, 0]}>
            {rows.map((row) => (
              <Cell key={row.category} fill="var(--color-leaf-500)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
