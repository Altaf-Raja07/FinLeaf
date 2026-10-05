import type { ReactNode } from "react";

/**
 * Shared primitives.
 *
 * These exist so the twenty-odd screens stay visually identical without each
 * one re-deriving padding and colours. Sizes and colours come from the tokens in
 * globals.css, which mirror design/design-system.md.
 */

/* --- Cards --------------------------------------------------------------- */

export function Card({
  children,
  className = "",
  as: Tag = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "aside";
}) {
  return (
    <Tag className={`rounded-lg border border-border bg-surface ${className}`}>{children}</Tag>
  );
}

export function CardHeader({
  title,
  action,
  className = "",
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 px-5 pt-4 ${className}`}>
      <h2 className="text-[17px] leading-6 font-semibold">{title}</h2>
      {action}
    </div>
  );
}

/* --- Buttons ------------------------------------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-45";

const BUTTON_VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-foreground hover:bg-sunken",
  ghost: "text-primary hover:bg-primary-soft",
  danger: "border border-danger bg-surface text-danger hover:bg-danger-soft",
};

// 44px on mobile, 40px from tablet up: always meets the touch-target minimum.
const BUTTON_SIZE: Record<ButtonSize, string> = {
  md: "h-11 px-4 text-[15px] md:h-10",
  lg: "h-12 px-5 text-[16px] md:h-11",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  ...rest
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  href,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={`${BUTTON_BASE} ${BUTTON_VARIANT[variant]} ${BUTTON_SIZE[size]} ${className}`}
    >
      {children}
    </a>
  );
}

/* --- Form fields --------------------------------------------------------- */

/**
 * Label sits above the field, never as a placeholder only, so the control is
 * identifiable once text is typed into it.
 */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint && !error && (
        <p id={`${htmlFor}-hint`} className="text-[13px] text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${htmlFor}-error`} className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

const CONTROL =
  "h-11 w-full rounded-sm border bg-surface px-3 text-[15px] " +
  "placeholder:text-muted disabled:opacity-45 disabled:cursor-not-allowed";

export function Input({
  invalid,
  className = "",
  ...rest
}: { invalid?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={`${CONTROL} ${invalid ? "border-danger" : "border-border-strong"} ${className}`}
      {...rest}
    />
  );
}

export function Textarea({
  invalid,
  className = "",
  ...rest
}: { invalid?: boolean } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={`w-full rounded-sm border bg-surface px-3 py-2.5 text-[15px] ${
        invalid ? "border-danger" : "border-border-strong"
      } ${className}`}
      {...rest}
    />
  );
}

export function Select({
  invalid,
  className = "",
  children,
  ...rest
}: { invalid?: boolean } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      aria-invalid={invalid || undefined}
      className={`${CONTROL} ${invalid ? "border-danger" : "border-border-strong"} ${className}`}
      {...rest}
    >
      {children}
    </select>
  );
}

/* --- Small pieces -------------------------------------------------------- */

/** Circular icon tile used for categories and quick actions. */
export function IconTile({
  children,
  tone = "primary",
  size = "md",
}: {
  children: ReactNode;
  tone?: "primary" | "leaf" | "trust" | "amber" | "neutral";
  size?: "sm" | "md" | "lg";
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    leaf: "bg-leaf-soft text-leaf",
    trust: "bg-trust-soft text-trust",
    amber: "bg-amber-soft text-amber",
    neutral: "bg-sunken text-muted",
  };
  const sizes = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-12 w-12" };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${tones[tone]} ${sizes[size]}`}
    >
      {children}
    </span>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "primary" | "leaf" | "trust" | "amber" | "danger";
}) {
  const tones = {
    neutral: "bg-sunken text-muted",
    primary: "bg-primary-soft text-primary",
    leaf: "bg-leaf-soft text-leaf",
    trust: "bg-trust-soft text-trust",
    amber: "bg-amber-soft text-amber",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

/** Muted explanatory strip. Always icon + text, never colour alone. */
export function Notice({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "amber" | "danger" | "trust";
}) {
  const tones = {
    neutral: "bg-sunken text-muted",
    amber: "bg-amber-soft text-amber",
    danger: "bg-danger-soft text-danger",
    trust: "bg-trust-soft text-trust",
  };
  return (
    <p className={`flex items-start gap-2 rounded-sm px-3 py-2.5 text-[13px] ${tones[tone]}`}>
      <span aria-hidden="true" className="mt-px shrink-0">
        <InfoIcon />
      </span>
      <span>{children}</span>
    </p>
  );
}

export function InfoIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="4.9" r="0.9" fill="currentColor" />
    </svg>
  );
}

/* --- Page states --------------------------------------------------------- */

/** Loading placeholder shaped like the content it replaces, so nothing jumps. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-sunken ${className}`} />;
}

export function LoadingBlock({ rows = 3, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-3 p-5">
      <span className="fl-sr-only">{label}</span>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="mt-2 h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  );
}

/** Empty state: says what is missing and offers the next action. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <span
        aria-hidden="true"
        className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-sunken text-muted"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="2.5" y="4" width="15" height="12" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2.5 8h15" stroke="currentColor" strokeWidth="1.4" />
        </svg>
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="max-w-sm text-[13px] text-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  title = "We could not load this",
  body,
  action,
}: {
  title?: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-5 py-12 text-center">
      <span
        aria-hidden="true"
        className="mb-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-danger-soft text-danger"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10 6v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="13.8" r="0.95" fill="currentColor" />
        </svg>
      </span>
      <p className="text-[15px] font-semibold">{title}</p>
      <p className="max-w-sm text-[13px] text-muted">{body}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}