"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useState, useRef, useEffect } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  ChevronDown,
  Gift,
  GraduationCap,
  LayoutDashboard,
  Leaf,
  PiggyBank,
  Shield,
  Users,
  HandCoins,
  MapPin,
  Menu,
  X,
  MessageCircleQuestion,
  Settings,
  User,
} from "lucide-react";
import { translate, type Locale } from "@/lib/i18n";
import { cn } from "@/components/ui";
import { LeafMark } from "@/components/LeafMark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "./sign-out-button";

interface NavItem {
  href: Route;
  labelKey: string;
  icon: typeof LayoutDashboard;
}

const PRIMARY_NAV: NavItem[] = [
  { href: "/dashboard", labelKey: "nav.dashboard", icon: LayoutDashboard },
  { href: "/dashboard/transfer", labelKey: "nav.transfer", icon: ArrowLeftRight },
  { href: "/dashboard/history", labelKey: "nav.history", icon: BarChart3 },
  { href: "/dashboard/savings", labelKey: "nav.savings", icon: PiggyBank },
  { href: "/dashboard/assistant", labelKey: "nav.assistant", icon: MessageCircleQuestion },
];

const MORE_NAV: NavItem[] = [
  { href: "/dashboard/bills", labelKey: "nav.bills", icon: HandCoins },
  { href: "/dashboard/loans", labelKey: "nav.loans", icon: Shield },
  { href: "/dashboard/circles", labelKey: "nav.circles", icon: Users },
  { href: "/dashboard/family", labelKey: "nav.family", icon: Users },
  { href: "/dashboard/agents", labelKey: "nav.agents", icon: MapPin },
  { href: "/dashboard/carbon", labelKey: "nav.carbon", icon: Leaf },
  { href: "/dashboard/rewards", labelKey: "nav.rewards", icon: Gift },
  { href: "/dashboard/learn", labelKey: "nav.learn", icon: GraduationCap },
];

export function NavBar({
  locale,
  name,
  role,
  unread,
}: {
  locale: Locale;
  name: string;
  role: string;
  unread: number;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const moreRef = useRef<HTMLLIElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const isMoreActive = MORE_NAV.some((item) => isActive(item.href));

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close menus on path change
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
    setMoreOpen(false);
    setUserMenuOpen(false);
  }

  const notificationsLabel =
    unread > 0
      ? `${t("notifications.title")}, ${t("notifications.unreadCount", { count: unread })}`
      : t("notifications.title");

  const initial = name?.trim() ? name.trim().charAt(0).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-surface/95 backdrop-blur-md">
      <a href="#main" className="sr-only-focus btn btn-primary absolute left-4 top-3">
        {t("nav.skipToContent")}
      </a>

      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5 no-underline group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-leaf-600 to-leaf-800 text-white shadow-sm shadow-leaf-600/30 group-hover:scale-105 transition-transform">
              <LeafMark className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-ink leading-tight">FinLeaf</span>
              <span className="text-[10px] font-medium text-leaf-700 tracking-wider uppercase">Rural Green Bank</span>
            </div>
          </Link>

          {/* Desktop Primary Nav */}
          <nav aria-label={t("nav.mainNavigation")} className="hidden md:block">
            <ul className="flex items-center gap-1">
              {PRIMARY_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold no-underline transition-[background-color,color] duration-150",
                      isActive(item.href)
                        ? "bg-leaf-100/70 text-leaf-950 font-bold shadow-xs"
                        : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t(item.labelKey)}</span>
                  </Link>
                </li>
              ))}

              {/* More / Services Dropdown */}
              <li className="relative" ref={moreRef}>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-[background-color,color] duration-150",
                    isMoreActive || moreOpen
                      ? "bg-leaf-100/70 text-leaf-950 font-bold"
                      : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
                  )}
                >
                  <span>Services</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
                </button>

                {moreOpen && (
                  <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-rule bg-surface p-2 shadow-xl ring-1 ring-black/5 animate-menu-in z-50">
                    <p className="px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase text-ink-faint">
                      Financial Services
                    </p>
                    <div className="space-y-0.5">
                      {MORE_NAV.slice(0, 5).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium no-underline transition-colors",
                            isActive(item.href)
                              ? "bg-leaf-50 text-leaf-900 font-bold"
                              : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
                          )}
                        >
                          <item.icon className="h-4 w-4 text-leaf-700" />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      ))}
                    </div>

                    <div className="my-2 border-t border-rule" />

                    <p className="px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase text-ink-faint">
                      Sustainability & Learning
                    </p>
                    <div className="space-y-0.5">
                      {MORE_NAV.slice(5).map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium no-underline transition-colors",
                            isActive(item.href)
                              ? "bg-leaf-50 text-leaf-900 font-bold"
                              : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
                          )}
                        >
                          <item.icon className="h-4 w-4 text-leaf-700" />
                          <span>{t(item.labelKey)}</span>
                        </Link>
                      ))}
                      {role === "ADMIN" && (
                        <Link
                          href="/admin"
                          className={cn(
                            "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium no-underline transition-colors",
                            isActive("/admin")
                              ? "bg-leaf-50 text-leaf-900 font-bold"
                              : "text-ink-soft hover:bg-surface-sunken hover:text-ink",
                          )}
                        >
                          <Settings className="h-4 w-4 text-ink-faint" />
                          <span>{t("nav.admin")}</span>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </li>
            </ul>
          </nav>
        </div>

        {/* Right Controls: Notifications, Language, User Menu */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Link
            href="/dashboard/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft hover:bg-surface-sunken transition-colors"
            aria-label={notificationsLabel}
          >
            <Bell className="h-4 w-4" aria-hidden="true" />
            {unread > 0 ? (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-leaf-700 px-1 text-[10px] font-bold text-white shadow-xs">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : null}
          </Link>

          {/* Language Switcher */}
          <LanguageSwitcher
            activeLocale={locale}
            labels={{ title: t("nav.language"), ariaLabel: t("nav.language") }}
          />

          {/* Desktop User Avatar & Dropdown */}
          <div className="relative hidden sm:block" ref={userRef}>
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-rule bg-surface p-1 pr-3 hover:bg-surface-sunken transition-colors"
              aria-expanded={userMenuOpen}
              aria-label="User profile menu"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-leaf-700 to-emerald-500 text-xs font-bold text-white shadow-xs">
                {initial}
              </div>
              <span className="max-w-[100px] truncate text-xs font-semibold text-ink">
                {name}
              </span>
              <ChevronDown className="h-3 w-3 text-ink-faint" />
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-rule bg-surface p-2 shadow-xl ring-1 ring-black/5 animate-menu-in z-50">
                <div className="px-3 py-2 border-b border-rule">
                  <p className="text-xs font-bold text-ink truncate">{name}</p>
                  <p className="text-[11px] text-ink-faint capitalize">{role.toLowerCase()}</p>
                </div>
                <div className="py-1">
                  <Link
                    href="/dashboard/profile"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-ink-soft hover:bg-surface-sunken hover:text-ink no-underline"
                  >
                    <User className="h-4 w-4 text-ink-faint" />
                    <span>{t("nav.profile")}</span>
                  </Link>
                </div>
                <div className="pt-1 border-t border-rule">
                  <SignOutButton label={t("nav.signOut")} />
                </div>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? t("nav.close") : t("nav.menu")}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink hover:bg-surface-sunken md:hidden"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileOpen && (
        <div id="mobile-nav" className="border-t border-rule bg-surface/98 backdrop-blur-md md:hidden max-h-[85vh] overflow-y-auto">
          <nav aria-label={t("nav.mainNavigation")} className="px-4 py-4 space-y-4">
            {/* User Info Bar */}
            <div className="flex items-center justify-between rounded-2xl bg-surface-sunken p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-leaf-700 to-emerald-500 text-sm font-bold text-white">
                  {initial}
                </div>
                <div>
                  <p className="text-xs font-bold text-ink truncate">{name}</p>
                  <p className="text-[10px] text-ink-faint uppercase tracking-wider">{role}</p>
                </div>
              </div>
              <SignOutButton label={t("nav.signOut")} />
            </div>

            {/* Primary Links */}
            <div>
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">
                Quick Actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PRIMARY_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl p-2.5 text-xs font-semibold no-underline transition-colors",
                      isActive(item.href)
                        ? "bg-leaf-100 text-leaf-950 font-bold"
                        : "bg-surface-sunken text-ink hover:bg-leaf-50",
                    )}
                  >
                    <item.icon className="h-4 w-4 text-leaf-700" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* All Services */}
            <div>
              <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">
                All Services & Features
              </p>
              <div className="grid grid-cols-2 gap-2">
                {MORE_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium no-underline transition-colors",
                      isActive(item.href)
                        ? "bg-leaf-100 text-leaf-950 font-bold"
                        : "border border-rule text-ink-soft hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    <item.icon className="h-4 w-4 text-leaf-700" />
                    <span className="truncate">{t(item.labelKey)}</span>
                  </Link>
                ))}
                <Link
                  href="/dashboard/profile"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border border-rule text-ink-soft hover:bg-surface-sunken no-underline"
                >
                  <User className="h-4 w-4 text-leaf-700" />
                  <span>{t("nav.profile")}</span>
                </Link>
                {role === "ADMIN" && (
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border border-rule text-ink-soft hover:bg-surface-sunken no-underline"
                  >
                    <Settings className="h-4 w-4 text-leaf-700" />
                    <span>{t("nav.admin")}</span>
                  </Link>
                )}
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
