import type { ComponentProps, ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind class merge: later classes win, so overrides compose predictably. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type Variant = "primary" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

export function Button({
  variant = "primary",
  className,
  loading = false,
  children,
  ...props
}: ComponentProps<"button"> & {
  variant?: Variant;
  loading?: boolean;
}) {
  return (
    <button
      className={cn("btn", buttonVariants[variant], className)}
      // Announced rather than hidden: a button that disappears and reappears is
      // disorienting for someone using a screen reader.
      aria-busy={loading || undefined}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("animate-spin h-4 w-4", className)}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8V0C5.4 0 0 5.4 0 12h4z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Link-styled-as-button
// ---------------------------------------------------------------------------

export function ButtonLink({
  variant = "primary",
  className,
  children,
  href,
  ...props
}: ComponentProps<"a"> & { variant?: Variant; href: string }) {
  return (
    <a
      href={href}
      className={cn("btn", buttonVariants[variant], "no-underline", className)}
      {...props}
    >
      {children}
    </a>
  );
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export function Card({
  children,
  className,
  id,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag id={id} className={cn("card", className)}>
      {children}
    </Tag>
  );
}

export function CardQuiet({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("card-quiet", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 mb-4", className)}>
      <div className="min-w-0">
        <h2 className="text-base font-bold tracking-tight truncate">{title}</h2>
        {subtitle ? (
          <p className="field-help mt-1 text-wrap-pretty">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  help,
  error,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor?: string;
  help?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("field", className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {help ? <p className="field-help">{help}</p> : null}
      {children}
      {error ? (
        <p className="field-error">{error}</p>
      ) : null}
    </div>
  );
}

/** A labelled group, e.g. a filter panel. */
export function Fieldset({
  legend,
  hint,
  children,
  className,
}: {
  legend: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex flex-col gap-3", className)}>
      <legend className="field-label mb-1">{legend}</legend>
      {hint ? <p className="field-help">{hint}</p> : null}
      {children}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

type Status = "good" | "warn" | "bad" | "neutral";

const pillStyles: Record<Status, string> = {
  good: "pill-good",
  neutral: "pill-neutral",
  warn: "pill-warn",
  bad: "pill-bad",
};

export function Pill({
  children,
  status = "neutral",
  className,
}: {
  children: ReactNode;
  status?: Status;
  className?: string;
}) {
  return (
    <span className={cn("pill", pillStyles[status], className)}>{children}</span>
  );
}

/**
 * Inline alert. `role` is asserted here rather than by the caller so a success
 * message is always announced and an error is always announced as an alert.
 */
export function Alert({
  tone = "info",
  title,
  children,
  className,
  icon,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "border-rule bg-surface-sunken text-ink",
    success: "border-leaf-200 bg-leaf-50 text-leaf-900",
    warning: "border-amber-base bg-amber-soft text-amber-strong",
    danger: "border-risk-high/40 bg-surface-sunken text-risk-crit",
  };

  const role = tone === "danger" ? "alert" : tone === "success" ? "status" : "note";

  return (
    <div
      role={role}
      className={cn(
        "rounded-card border p-3 text-sm leading-relaxed",
        tones[tone],
        className,
      )}
    >
      <div className="flex gap-2.5">
        {icon ? <span className="shrink-0 mt-0.5">{icon}</span> : null}
        <div className="min-w-0">
          {title ? <p className="font-bold mb-0.5">{title}</p> : null}
          {children ? (
            <div className="text-ink-soft">{children}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

/** Big number + label + optional delta. The main dashboard stat. */
export function Stat({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("card flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-ink-faint">
          {label}
        </p>
        {icon ? <span className="text-ink-faint">{icon}</span> : null}
      </div>
      <p className="text-2xl font-bold tracking-tight tnum leading-none">{value}</p>
      {hint ? <p className="field-help">{hint}</p> : null}
    </div>
  );
}

/**
 * Linear progress. Deliberately includes the value in text as well as the bar,
 * because a green bar alone tells a screen reader nothing and tells a user
 * with red-green colour vision deficiency very little.
 */
export function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, Math.round((value / max) * 100)));
  return (
    <div className={className}>
      <div
        className="h-2.5 w-full rounded-full bg-surface-sunken overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-leaf-600 transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="field-help mt-1 tnum">{label}</p>
    </div>
  );
}

/** Empty state. Always says what to do next, so it never reads as a broken page. */
export function EmptyState({
  title,
  body,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-card border border-dashed border-rule p-8 text-center",
        className,
      )}
    >
      {icon ? <span className="text-ink-faint">{icon}</span> : null}
      <p className="font-bold">{title}</p>
      {body ? <p className="field-help max-w-sm text-pretty">{body}</p> : null}
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section headings
// ---------------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-wider text-leaf-700 mb-1">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-balance">
          {title}
        </h1>
        {subtitle ? (
          <p className="field-help mt-2 max-w-2xl text-pretty">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
