/**
 * Score gauge and charts.
 *
 * Hand-rolled SVG rather than a charting dependency: the two shapes we need are
 * simple, and this keeps the bundle small on the low-end devices the design
 * system targets.
 *
 * Accessibility: every chart carries role="img" with a text summary, so the
 * information is available without seeing the drawing.
 */

export function ScoreGauge({
  value,
  label,
  band,
  tone = "trust",
  size = 96,
}: {
  /** 0-100. */
  value: number;
  label: string;
  band?: string;
  tone?: "trust" | "leaf" | "primary";
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = size >= 88 ? 9 : 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A 270-degree arc: three quarters of the circle, opening at the bottom.
  const arc = circumference * 0.75;
  const filled = arc * (clamped / 100);
  const colours = { trust: "var(--fl-trust)", leaf: "var(--fl-leaf)", primary: "var(--fl-primary)" };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label}: ${clamped} out of 100${band ? `, ${band}` : ""}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--fl-surface-sunken)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
            transform={`rotate(135 ${size / 2} ${size / 2})`}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={colours[tone]}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            transform={`rotate(135 ${size / 2} ${size / 2})`}
          />
        </svg>
        <span className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="fl-num font-semibold"
            style={{ fontSize: size >= 88 ? 26 : 19, lineHeight: 1 }}
          >
            {clamped}
          </span>
        </span>
      </div>
      <span className="mt-1.5 text-[13px] font-medium">{label}</span>
      {band && (
        <span
          className="mt-1 rounded-full px-2.5 py-0.5 text-[12.5px] font-medium"
          style={{
            background: tone === "leaf" ? "var(--fl-leaf-soft)" : tone === "primary" ? "var(--fl-primary-soft)" : "var(--fl-trust-soft)",
            color: colours[tone],
          }}
        >
          {band}
        </span>
      )}
    </div>
  );
}

/** Vertical bar chart, used for the dashboard's monthly emissions. */
export function BarChart({
  data,
  height = 148,
  unit,
}: {
  data: Array<{ label: string; value: number; highlight?: boolean }>;
  height?: number;
  unit: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  // Reserve space above the plot for the value labels and below for the month
  // labels. Without the top band, a label on a full-height bar is clipped.
  const labelBand = 22;
  const axisBand = 26;
  const plotHeight = Math.max(40, height - labelBand - axisBand);

  const summary = `${unit} by month: ${data
    .map((d) => `${d.label} ${d.value}`)
    .join(", ")}.`;

  const slot = 84;
  const barWidth = 34;

  return (
    <div>
      <svg
        viewBox={`0 0 ${data.length * slot} ${height}`}
        className="w-full"
        role="img"
        aria-label={summary}
      >
        {/* Gridlines at the halfway point and at the axis. */}
        {[0.5, 1].map((fraction) => {
          const y = labelBand + plotHeight - fraction * plotHeight;
          return (
            <line
              key={fraction}
              x1="0"
              x2={data.length * slot}
              y1={y}
              y2={y}
              stroke="var(--fl-border)"
              strokeWidth="1"
            />
          );
        })}

        {data.map((point, index) => {
          const barHeight = Math.max(3, (point.value / max) * plotHeight);
          const x = index * slot + (slot - barWidth) / 2;
          const y = labelBand + plotHeight - barHeight;
          return (
            <g key={point.label}>
              <text
                x={x + barWidth / 2}
                y={y - 7}
                textAnchor="middle"
                fontSize="13"
                className="fl-num"
                fontWeight={point.highlight ? 600 : 400}
                fill="var(--fl-text-muted)"
              >
                {point.value}
              </text>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="4"
                fill={point.highlight ? "var(--fl-primary)" : "#cfe3d8"}
              />
              <text
                x={x + barWidth / 2}
                y={labelBand + plotHeight + 18}
                textAnchor="middle"
                fontSize="12"
                fontWeight={point.highlight ? 600 : 400}
                fill="var(--fl-text-muted)"
              >
                {point.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Horizontal bars with labels and values, for category breakdowns. */
export function HorizontalBars({
  data,
  unit,
  tone = "var(--fl-leaf)",
}: {
  data: Array<{ label: string; value: number }>;
  unit: string;
  tone?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const summary = `${unit}: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}.`;

  return (
    <div role="img" aria-label={summary} className="flex flex-col gap-3">
      {data.map((item) => (
        <div key={item.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[13px]">{item.label}</span>
          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sunken">
            <span
              className="block h-full rounded-full"
              style={{ width: `${(item.value / max) * 100}%`, background: tone }}
            />
          </span>
          <span className="fl-num w-16 shrink-0 text-right text-[13px] font-medium">
            {item.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Line chart for trends, with an optional highlighted final point. */
export function LineChart({
  data,
  height = 168,
  unit,
  tone = "var(--fl-leaf)",
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  unit: string;
  tone?: string;
}) {
  if (data.length < 2) return null;

  const width = 560;
  const padX = 34;
  const padY = 22;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = 0;

  const x = (index: number) => padX + (index / (data.length - 1)) * innerW;
  const y = (value: number) => padY + innerH - ((value - min) / (max - min || 1)) * innerH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${padY + innerH} L${padX},${padY + innerH} Z`;
  const last = data[data.length - 1];

  const summary = `${unit} by month: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}.`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label={summary}>
      {[0, 0.5, 1].map((fraction) => {
        const value = max * fraction;
        const gy = y(value);
        return (
          <g key={fraction}>
            <line x1={padX} x2={width - padX} y1={gy} y2={gy} stroke="var(--fl-border)" strokeWidth="1" />
            <text
              x={padX - 6}
              y={gy + 3.5}
              textAnchor="end"
              fontSize="10.5"
              className="fl-num"
              fill="var(--fl-text-muted)"
            >
              {Math.round(value)}
            </text>
          </g>
        );
      })}

      <path d={area} fill={tone} opacity="0.08" />
      <path d={line} fill="none" stroke={tone} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {data.map((d, i) => (
        <circle key={d.label} cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 4.5 : 2.6} fill={i === data.length - 1 ? tone : "var(--fl-surface)"} stroke={tone} strokeWidth="1.8" />
      ))}

      {/* Label the final point, which is the one the user is reading. */}
      <text
        x={x(data.length - 1) - 4}
        y={y(last.value) - 11}
        textAnchor="end"
        fontSize="11"
        className="fl-num"
        fontWeight="600"
        fill="var(--fl-text)"
      >
        {last.value}
      </text>

      {data.map((d, i) => (
        <text
          key={`${d.label}-axis`}
          x={x(i)}
          y={height - 6}
          textAnchor="middle"
          fontSize="10.5"
          fill="var(--fl-text-muted)"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}