"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  Gift,
  GraduationCap,
  LayoutDashboard,
  Leaf,
  LogOut,
  PiggyBank,
  Shield,
  Users,
  HandCoins,
  MapPin,
  Menu,
  X,
  MessageCircleQuestion,
  Settings,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { cn } from "@/components/ui";
import { LeafMark } from "@/components/LeafMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "./sign-out-button";

/**
 * Authenticated navigation.
 *
 * Icon-plus-label rather than icon-only: an unlabelled icon is unreadable to a
 * first-time user and meaningless to anyone using a screen reader. Every icon
 * is decorative here and hidden from assistive technology, because the adjacent
 * text already carries the meaning.
 */

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transfer", label: "Send money", icon: ArrowLeftRight },
  { href: "/dashboard/history", label: "History", icon: BarChart3 },
  { href: "/dashboard/bills", label: "Bills", icon: HandCoins },
  { href: "/dashboard/loans", label: "Loans", icon: Shield },
  { href: "/dashboard/savings", label: "Savings", icon: PiggyBank },
  { href: "/dashboard/learn", label: "Learn", icon: GraduationCap },
  { href: "/dashboard/circles", label: "Circles", icon: Users },
  { href: "/dashboard/family", label: "Family", icon: Users },
  { href: "/dashboard/agents", label: "Agents", icon: MapPin },
  { href: "/dashboard/carbon", label: "Carbon", icon: Leaf },
  { href: "/dashboard/rewards", label: "Rewards", icon: Gift },
  { href: "/dashboard/assistant", label: "Assistant", icon: MessageCircleQuestion },
  { href: "/dashboard/profile", label: "Profile", icon: Settings },
];

export function NavBar({
  locale,
  name,
  role,
  unread,
  labels,
}: {
  locale: Locale;
  name: string;
  role: string;
  unread: number;
  labels: {
    signOut: string;
    language: string;
    menu: string;
    close: string;
    skip: string;
  };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const items = role === "ADMIN"
    ? [...NAV, { href: "/admin", label: "Admin", icon: Settings as never }]
    : NAV;

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-surface/95 backdrop-blur">
      <a href="#main" className="sr-only-focus btn btn-primary absolute left-4 top-3">
        {labels.skip}
      </a>

      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2 no-underline">
          <LeafMark className="h-8 w-8 text-leaf-700" />
          <span className="text-lg font-bold tracking-tight">FinLeaf</span>
        </Link>

        <nav aria-label="Main" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-0.5">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-sm font-semibold no-underline transition-colors",
                    isActive(item.href)
                      ? "bg-leaf-50 text-leaf-900"
                      : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Link
            href="/dashboard/notifications"
            className="relative rounded-lg p-2 text-ink-soft hover:bg-surface-sunken"
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {unread > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-leaf-700 px-1 text-[0.625rem] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>

          <LanguageSwitcher
            activeLocale={locale}
            labels={{ title: labels.language, ariaLabel: labels.language }}
          />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? labels.close : labels.menu}
            className="btn btn-ghost lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <div id="mobile-nav" className="border-t border-rule lg:hidden">
          <nav aria-label="Main" className="mx-auto max-w-5xl px-4 py-3">
            <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold no-underline",
                      isActive(item.href)
                        ? "bg-leaf-50 text-leaf-900"
                        : "text-ink-soft hover:bg-surface-sunken",
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{name}</p>
              </div>
              <SignOutButton label={labels.signOut} />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
