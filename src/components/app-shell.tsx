import Link from "next/link";
import type { ReactNode } from "react";
import {
  BellIcon,
  BillIcon,
  BookIcon,
  ChevronRight,
  GearIcon,
  HomeIcon,
  LeafIcon,
  PiggyIcon,
  ReceiptIcon,
  SendIcon,
  TargetIcon,
  WalletIcon,
} from "./icons";

/**
 * Application shell: sidebar on desktop, bottom tab bar on mobile.
 *
 * The navigation list is the one defined in design/manifest.md and locked in the
 * shared prompt block: Home, Accounts, Send money, Transactions, Pay bills,
 * Save, Loans, Sustainability, Learn. There is deliberately no global search,
 * because the approved references show none.
 */

interface NavItem {
  href: string;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
}

/** Desktop sidebar order, as locked in design/manifest.md. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/accounts", label: "Accounts", icon: WalletIcon },
  { href: "/transfer", label: "Send money", icon: SendIcon },
  { href: "/transactions", label: "Transactions", icon: ReceiptIcon },
  { href: "/bills", label: "Pay bills", icon: BillIcon },
  { href: "/goals", label: "Save", icon: PiggyIcon },
  { href: "/loans", label: "Loans", icon: TargetIcon },
  { href: "/sustainability", label: "Sustainability", icon: LeafIcon },
  { href: "/learn", label: "Learn", icon: BookIcon },
];

/** Mobile bottom bar: five items, per the mobile reference. */
const MOBILE_TABS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/transfer", label: "Transfer", icon: SendIcon },
  { href: "/bills", label: "Bills", icon: BillIcon },
  { href: "/goals", label: "Goals", icon: PiggyIcon },
  { href: "/settings", label: "More", icon: GearIcon },
];

function isActive(href: string, pathname: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2" aria-label="FinLeaf home">
      <span className="text-primary">
        <LeafIcon size={26} />
      </span>
      {!compact && <span className="text-[21px] font-bold tracking-tight">FinLeaf</span>}
    </Link>
  );
}

export function AppShell({
  pathname,
  userName,
  children,
  alerts = 0,
}: {
  pathname: string;
  userName: string;
  children: ReactNode;
  alerts?: number;
}) {
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-dvh">
      <a href="#main" className="fl-skip-link">
        Skip to main content
      </a>

      <div className="flex">
        {/* --- Desktop sidebar (hidden below 1024px) ---------------------- */}
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border bg-surface lg:flex">
          <div className="px-5 py-5">
            <Wordmark />
          </div>

          <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
            <ul className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors ${
                        active
                          ? "bg-primary-soft text-primary"
                          : "text-foreground hover:bg-sunken"
                      }`}
                    >
                      <Icon size={19} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-border p-3">
            <Link
              href="/settings"
              className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-sunken"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary"
              >
                {initials}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{userName}</span>
                <span className="block text-[13px] text-muted">View profile</span>
              </span>
              <ChevronRight size={16} />
            </Link>
          </div>
        </aside>

        {/* --- Content --------------------------------------------------- */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile app bar: replaces the sidebar's brand row. */}
          <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
            <Wordmark />
            <Link
              href="/security/alerts"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-md text-muted"
              aria-label={alerts > 0 ? `Notifications, ${alerts} need review` : "Notifications"}
            >
              <BellIcon size={20} />
              {alerts > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-leaf"
                />
              )}
            </Link>
          </header>

          <main id="main" className="flex-1 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-10">
            <div className="mx-auto w-full max-w-[1200px]">{children}</div>
          </main>

          {/* Mobile bottom tab bar */}
          <nav
            aria-label="Main"
            className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface lg:hidden"
          >
            <ul className="grid grid-cols-5">
              {MOBILE_TABS.map((item) => {
                const active = isActive(item.href, pathname);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-[60px] flex-col items-center justify-center gap-1 py-2 text-[12px] font-medium ${
                        active ? "text-primary" : "text-muted"
                      }`}
                    >
                      <Icon size={21} />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}

/**
 * Page header: heading, supporting line, and an optional action slot.
 *
 * The notification bell sits here on desktop, matching the references; on mobile
 * it lives in the app bar instead so it does not compete with the bottom tabs.
 */
export function PageHeader({
  title,
  subtitle,
  action,
  alerts = 0,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  alerts?: number;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[22px] leading-7 font-bold tracking-tight md:text-[26px] md:leading-8">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-[14px] text-muted md:text-[15px]">{subtitle}</p>}
      </div>
      {action ?? (
        <Link
          href="/security/alerts"
          className="relative hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted hover:bg-sunken lg:inline-flex"
          aria-label={alerts > 0 ? `Notifications, ${alerts} need review` : "Notifications"}
        >
          <BellIcon size={19} />
          {alerts > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-leaf"
            />
          )}
        </Link>
      )}
    </div>
  );
}
