"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCo2e, formatMonth, type Locale } from "@/lib/i18n";
import { EmptyState } from "@/components/ui";

/**
 * Monthly carbon trend for the carbon page.
 *
 * Same shape as the dashboard chart, but scaled to a year and with the chart and
 * its text equivalent stacked. A screen-reader-only table carries the identical
 * figures, because a chart alone is not accessible data.
 */
export function CarbonTrendChart({
  data,
  locale,
}: {
  data: Array<{ month: Date; co2eKg: number }>;
  locale: Locale;
}) {
  if (!data.some((d) => d.co2eKg > 0)) {
    return <EmptyState title="No spending recorded yet" />;
  }

  const rows = data.map((d) => ({
    month: formatMonth(d.month, locale),
    co2eKg: d.co2eKg,
  }));

  return (
    <div>
      <div
        className="h-64 w-full"
        role="img"
        aria-label={`Estimated monthly carbon: ${rows
          .map((r) => `${r.month} ${formatCo2e(r.co2eKg, locale)}`)
          .join(", ")}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="carbonYearFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-leaf-500)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-leaf-500)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
            <XAxis
              dataKey="month"
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
              contentStyle={{
                borderRadius: "0.75rem",
                border: "1px solid var(--color-rule)",
                background: "var(--color-surface-raised)",
                fontSize: "0.8125rem",
              }}
            />
            <Area
              type="monotone"
              dataKey="co2eKg"
              stroke="var(--color-leaf-600)"
              strokeWidth={2}
              fill="url(#carbonYearFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* The text equivalent — the chart is decoration without it. */}
      <table className="sr-only">
        <caption>Estimated carbon emissions by month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Estimated CO₂e</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <th scope="row">{r.month}</th>
              <td>{formatCo2e(r.co2eKg, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
