import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  Play,
  Search,
  Smartphone,
  Activity,
  Leaf,
  Users,
  ShieldCheck,
  MapPin,
  Languages,
} from "lucide-react";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { ImpactEstimator } from "@/components/landing/ImpactEstimator";

/**
 * Public landing page.
 *
 * Laid out to match design/HomePage.png and guided by the getdesign.md
 * NerdWallet financial design system and taste-skill v2 principles:
 * - Emerald & spruce primary palette with mint-wash surfaces
 * - High-contrast readable typography
 * - Complete section coverage (Hero, Features, How It Works, Impact, Live Estimator, Community Trust)
 * - Zero dangling navigation hashes
 */
export default async function HomePage() {
  const { t, locale } = await translator();

  const user = await currentUser();
  if (user) redirect("/dashboard");

  /**
   * Nav is shared by the header and the footer. Section links stay on the page
   * as plain anchors (`#`) so they cannot be swallowed by client navigation;
   * anything else is a real route and goes through `next/link`.
   */
  const navItems = [
    { label: t("nav.home"), href: "/" as const, current: true },
    { label: t("nav.about"), href: "/about" as const },
    { label: t("nav.features"), hash: "#features" as const },
    { label: t("nav.how"), hash: "#how-it-works" as const },
    { label: t("nav.impact"), hash: "#impact" as const },
    { label: t("nav.demo"), hash: "#demo" as const },
    { label: t("nav.contact"), hash: "#contact" as const },
  ];

  const toc = [
    {
      icon: "/landing/tick-users.png",
      label: t("landing.hero.tickUnbanked"),
      x: -3,
      y: -2,
      labelY: 0,
    },
    {
      icon: "/landing/tick-leaf.png",
      label: t("landing.hero.tickCarbon"),
      x: 208,
      y: -2,
      labelY: 0,
    },
    {
      icon: "/landing/tick-chart.png",
      label: t("landing.hero.tickCredit"),
      x: 396,
      y: -3,
      labelY: 0,
    },
    {
      icon: "/landing/tick-gift.png",
      label: t("landing.hero.tickRewards"),
      x: 618,
      y: -5,
      labelY: 3,
    },
  ];

  const features = [
    {
      icon: "/landing/feat-banking.png",
      title: t("landing.features.bankingTitle"),
      body: t("landing.features.bankingBody"),
      textWidth: 194,
      bg: "bg-[#F2F8FD]",
    },
    {
      icon: "/landing/feat-credit.png",
      title: t("landing.features.creditTitle"),
      body: t("landing.features.creditBody"),
      textWidth: 194,
      bg: "bg-[#F7F4FC]",
    },
    {
      icon: "/landing/feat-carbon.png",
      title: t("landing.features.carbonTitle"),
      body: t("landing.features.carbonBody"),
      textWidth: 194,
      bg: "bg-[#F1FBF6]",
    },
    {
      icon: "/landing/feat-rewards.png",
      title: t("landing.features.rewardsTitle"),
      body: t("landing.features.rewardsBody"),
      textWidth: 140,
      bg: "bg-[#FDF7F1]",
    },
  ];

  const stats = [
    {
      icon: "/landing/stat-unbanked.png",
      value: t("landing.stats.unbankedValue"),
      label: t("landing.stats.unbankedLabel"),
      labelMaxWidth: 246,
      valueClass: "text-[#0B72E7]",
      bg: "bg-[#F1F7FD]",
    },
    {
      icon: "/landing/stat-women.png",
      value: t("landing.stats.womenValue"),
      label: t("landing.stats.womenLabel"),
      labelMaxWidth: 135,
      valueClass: "text-[#8432D9]",
      bg: "bg-[#F5F2FB]",
    },
    {
      icon: "/landing/stat-poor.png",
      value: t("landing.stats.poorestValue"),
      label: t("landing.stats.poorestLabel"),
      labelMaxWidth: 120,
      valueClass: "text-[#EC0C64]",
      bg: "bg-[#FDF1F6]",
    },
    {
      icon: "/landing/stat-edu.png",
      value: t("landing.stats.eduValue"),
      label: t("landing.stats.eduLabel"),
      labelMaxWidth: 110,
      valueClass: "text-[#F0801E]",
      bg: "bg-[#FDF8F0]",
    },
  ];

  const socials = [
    { icon: "/landing/soc-github.png", label: t("landing.social.github") },
    { icon: "/landing/soc-linkedin.png", label: t("landing.social.linkedin") },
    { icon: "/landing/soc-mail.png", label: t("landing.social.email") },
  ];

  const navClass =
    "text-[13px] font-semibold text-[#273A42] transition-colors hover:text-[#077443]";
  const footerNavClass =
    "text-[12.5px] font-medium text-[#C4D2CC] transition-colors hover:text-white";

  return (
    <div className="min-h-dvh bg-white text-[#091B27] desk:pl-[6px]">
      {/* ================================================================ header */}
      <header className="relative z-20 h-20 bg-white">
        <div className="relative mx-auto h-full w-full max-w-[1344px] px-4 desk:px-0">
          <div className="flex h-full items-center justify-between desk:block">
            <Link
              href="/"
              aria-label={t("landing.logoAlt")}
              className="relative block h-[48px] w-[165px] sm:h-[64px] sm:w-[220px] desk:absolute desk:-left-px desk:top-1 desk:h-[76px] desk:w-[260px]"
            >
              <Image
                src="/landing/logo-header.png"
                alt=""
                width={260}
                height={76}
                priority
                unoptimized
                className="h-full w-full object-contain"
              />
            </Link>

            <nav
              aria-label={t("nav.home")}
              className="absolute left-1/2 top-[22px] hidden -translate-x-1/2 desk:block"
            >
              <ul className="flex items-center gap-[34px]">
                {navItems.map((item) =>
                  "hash" in item ? (
                    <li key={item.hash}>
                      <a href={item.hash} className={navClass}>
                        {item.label}
                      </a>
                    </li>
                  ) : (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={item.current ? "page" : undefined}
                        className={`${
                          item.current
                            ? "relative text-[#077443] after:absolute after:inset-x-0 after:-bottom-[13px] after:h-[3px] after:rounded-full after:bg-[#077443]"
                            : ""
                        } ${navClass}`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>

            <div className="flex items-center gap-2 sm:gap-3 desk:absolute desk:right-0 desk:top-[15px] desk:gap-0">
              <button
                type="button"
                aria-label={t("nav.search")}
                className="hidden sm:grid h-10 w-10 place-items-center rounded-full bg-[#F1F6F3] text-[#0E3A2A] transition-colors hover:bg-[#E6F2EC]"
              >
                <Search className="h-4 w-4" strokeWidth={2.4} />
              </button>
              <Link
                href="/sign-in"
                className="grid h-[38px] sm:h-[42px] place-items-center rounded-[10px] border border-[#D3E5DC] bg-white px-3 sm:px-[25px] text-xs sm:text-[14.5px] font-semibold text-[#077443] transition-colors hover:border-[#077443] desk:ml-[14px]"
              >
                {t("nav.login")}
              </Link>
              <Link
                href="/sign-in"
                className="grid h-[38px] sm:h-[42px] place-items-center rounded-xl bg-[#077443] px-3.5 sm:px-[30.5px] text-xs sm:text-[14.5px] font-semibold text-white transition-colors hover:bg-[#055F36] desk:ml-[17px]"
              >
                {t("landing.hero.getStarted")}
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* ============================================================== hero */}
        <section className="relative bg-gradient-to-b from-[#FBFDFB] to-[#F2F9F3] desk:h-[450px]">
          {/* Width tracks the viewport instead of being pinned at 860px.
              The visual is anchored to the viewport's right edge while every
              other hero element sits inside the centred 1344px container, so a
              fixed 860px ran the hero copy under the photograph on any screen
              narrower than ~1800px — 115px of overlap at 1440px. `50vw + 4px`
              is the width at which the two just clear, which holds a constant
              24px gap from the `desk` breakpoint up and reaches the mockup's
              860px exactly at 1712px. `h-auto` keeps the 860x450 ratio so the
              photograph is never squashed. */}
          <Image
            src="/landing/hero-visual.png"
            alt={t("landing.hero.visualAlt")}
            width={860}
            height={450}
            priority
            className="absolute right-0 top-0 hidden h-auto w-[calc(50vw+4px)] max-w-[860px] desk:block"
          />

          <div className="relative mx-auto h-full max-w-[1344px]">
            <div className="relative left-0 top-0 px-4 pb-10 pt-1 desk:absolute desk:left-1 desk:top-0 desk:w-[640px] desk:p-0">
              <p className="mt-[25px] uppercase text-[16px] font-bold leading-6 tracking-[0.017em] text-[#085A2F]">
                {t("home.eyebrow")}
              </p>

              <h1 className="mt-[4px] text-[38px] font-extrabold leading-[42px] tracking-[-0.01em] text-[#071929] desk:text-[50px] desk:leading-[52px]">
                <span className="block">{t("landing.hero.titleL1")}</span>
                <span className="block">
                  {t("landing.hero.titleL2")}{" "}
                  <span className="text-[#077744]">
                    {t("landing.hero.titleL2h")}
                  </span>
                </span>
                <span className="block">
                  {t("landing.hero.titleL3")}{" "}
                  <span className="text-[#077744]">
                    {t("landing.hero.titleL3h")}
                  </span>
                </span>
              </h1>

              <p className="mt-[9px] max-w-[640px] text-[17px] leading-[27px] text-[#242B35]">
                {t("home.subtitle")}
              </p>

              <div className="mt-[20px] flex flex-wrap items-center gap-[19px]">
                <Link
                  href="/sign-in"
                  className="inline-flex h-[56px] items-center justify-center gap-[10px] rounded-[14px] bg-[#077443] text-[17px] font-semibold text-white transition-colors hover:bg-[#055F36] w-[225px]"
                >
                  {t("landing.hero.getStarted")}
                  <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
                </Link>
                <Link
                  href="/sign-in"
                  className="inline-flex h-[56px] w-[197px] items-center rounded-[14px] border border-[#DCE9E1] bg-white text-[15px] font-medium text-[#0F1B27] transition-colors hover:border-[#077443]"
                >
                  <span className="ml-[33px] grid h-7 w-7 place-items-center rounded-full bg-[#077443]">
                    <Play className="h-3 w-3 fill-white text-white" />
                  </span>
                  <span className="ml-[10px]">
                    {t("landing.hero.watchDemo")}
                  </span>
                </Link>
              </div>

            </div>

            <ul className="absolute left-0 top-[378px] block hidden w-[820px] desk:block">
              {toc.map((item) => (
                <li
                  key={item.icon}
                  className="absolute flex items-start gap-[15px]"
                  style={{ left: item.x, top: item.y }}
                >
                  <Image
                    src={item.icon}
                    alt=""
                    width={40}
                    height={40}
                    unoptimized
                    className="h-10 w-10 shrink-0"
                  />
                  <span
                    className="whitespace-pre text-[12.5px] font-medium leading-[19px] text-[#3D4751]"
                    style={{ paddingTop: 3 + item.labelY }}
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ========================================================== features */}
        <section id="features" className="bg-white">
          <div className="relative mx-auto max-w-[1344px] pt-[5px]">
            <h2 className="text-center text-[27px] font-bold leading-[33px] text-[#071929]">
              {t("landing.features.title")}
            </h2>
            <p className="mt-[2px] text-center text-[16px] leading-[24px] text-[#55606C]">
              {t("landing.features.subtitle")}
            </p>

            <div className="mt-[8px] grid grid-cols-1 gap-[15px] min-[768px]:grid-cols-2 min-[1280px]:grid-cols-4 desk:grid-cols-[326px_327px_329px_318px]">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className={`flex gap-[15px] rounded-2xl p-[7px] desk:h-[149px] ${feature.bg}`}
                >
                  <Image
                    src={feature.icon}
                    alt=""
                    width={76}
                    height={76}
                    unoptimized
                    className="h-[76px] w-[76px] shrink-0"
                  />
                  <div
                    className="min-w-0 flex-1 pt-[8px] desk:w-[var(--tw-feature-w)] desk:flex-none"
                    style={
                      { "--tw-feature-w": `${feature.textWidth}px` } as React.CSSProperties
                    }
                  >
                    <h3 className="whitespace-pre-line text-[18px] font-bold leading-[24px] text-[#1A212C]">
                      {feature.title}
                    </h3>
                    <p className="mt-[3px] text-[15px] leading-[21px] text-[#55606C]">
                      {feature.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* =================================================== how it works */}
        <section id="how-it-works" className="mt-16 border-y border-[#b7ecda]/50 bg-[#effcf8]/50 py-16 px-4">
          <div className="relative mx-auto max-w-[1344px]">
            <div className="text-center">
              <span className="inline-block rounded-full bg-[#008254]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#006642]">
                {t("nav.how")}
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#071929] sm:text-3xl">
                Banking Built from the Ground Up for Inclusion
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-base text-[#55606C]">
                Four simple, transparent steps connecting underserved communities to basic banking, credit dignity, and climate accountability.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col justify-between rounded-2xl border border-[#d8d9da] bg-white p-6 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-[#008254]/40 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black text-[#008254]">01</span>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#effcf8] text-[#008254]">
                      <Smartphone className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#071929]">Phone-First Access</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#55606C]">
                    Sign in or register in 30 seconds with your phone number and an SMS OTP. No paperwork, no branch visits, and zero account maintenance charges.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[#d8d9da] bg-white p-6 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-[#008254]/40 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black text-[#008254]">02</span>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#effcf8] text-[#008254]">
                      <Activity className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#071929]">Behavioral Trust Score</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#55606C]">
                    Our machine learning models score 8 explainable factors (utility bills, peer vouches, micro-savings habits) rather than biased demographic proxies.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[#d8d9da] bg-white p-6 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-[#008254]/40 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black text-[#008254]">03</span>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#effcf8] text-[#008254]">
                      <Leaf className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#071929]">Carbon Accounting</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#55606C]">
                    Every spend calculates estimated greenhouse emissions based on India’s CEA baseline. Low-carbon habits earn Green Points redeemable for verified offsets.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-[#d8d9da] bg-white p-6 shadow-sm transition-[border-color,box-shadow] duration-150 hover:border-[#008254]/40 hover:shadow-md">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-black text-[#008254]">04</span>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#effcf8] text-[#008254]">
                      <Users className="h-5 w-5" aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-[#071929]">Community Lending</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#55606C]">
                    Access fair micro-loans sized directly to your trust score with predictable schedules, or form village self-help trust circles to vouch for neighbors.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ======================================================== set stats */}
        <section id="impact" className="bg-white py-16 px-4">
          <div className="relative mx-auto max-w-[1344px]">
            <div className="text-center">
              <span className="inline-block rounded-full bg-[#008254]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#006642]">
                {t("nav.impact")}
              </span>
              <h2 className="mt-3 text-2xl font-bold leading-[30px] text-[#071929] sm:text-3xl">
                {t("landing.problems.title")}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-base text-[#55606C]">
                Why digital financial inclusion combined with environmental transparency matters for our future.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-[15px] min-[768px]:grid-cols-2 min-[1280px]:grid-cols-4 desk:grid-cols-[338px_316px_315px_330px]">
              {stats.map((stat) => (
                <div
                  key={stat.value}
                  className={`flex min-h-[101px] items-start rounded-2xl pt-[8px] desk:h-[101px] ${stat.bg}`}
                >
                  <Image
                    src={stat.icon}
                    alt=""
                    width={88}
                    height={88}
                    unoptimized
                    className="ml-[19px] h-[88px] w-[88px] shrink-0"
                  />
                  <div className="ml-[6px] min-w-0 flex-1">
                    <p
                      className={`mt-[5px] text-[25px] font-bold leading-[28px] ${stat.valueClass}`}
                    >
                      {stat.value}
                    </p>
                    <p
                      className="mt-[1px] max-w-full text-[15px] leading-[21px] text-[#3D4751] desk:max-w-[var(--tw-label-w)]"
                      style={
                        {
                          "--tw-label-w": `${stat.labelMaxWidth}px`,
                        } as React.CSSProperties
                      }
                    >
                      {stat.label}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl border border-[#ebebec] bg-[#f7f7f7] p-5 text-center text-xs leading-relaxed text-[#55606C]">
              <p>
                <strong className="text-[#071929]">Data & Regulatory Integrity:</strong> Global statistics sourced from the World Bank Global Findex Database (2025). Behavioral scoring is modeled strictly following the Reserve Bank of India (RBI) Digital Lending Directions (2025). Carbon accounting follows GHG Protocol Scope 3.1 category factors based on India’s Central Electricity Authority (CEA) CO₂ Baseline.
              </p>
            </div>
          </div>
        </section>

        {/* ==================================================== live demo */}
        <section id="demo" className="border-t border-[#b7ecda]/50 bg-[#effcf8]/40 py-16 px-4">
          <div className="relative mx-auto max-w-[1344px]">
            <div className="mb-10 text-center">
              <span className="inline-block rounded-full bg-[#008254]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#006642]">
                {t("nav.demo")}
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#071929] sm:text-3xl">
                Try the Financial Impact Estimator
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-base text-[#55606C]">
                Explore how responsible spending, savings habits, and timely bill payments unlock credit reputation and green rewards.
              </p>
            </div>

            <ImpactEstimator locale={locale} />
          </div>
        </section>

        {/* ==================================================== contact / trust */}
        <section id="contact" className="border-t border-[#ebebec] bg-white py-16 px-4">
          <div className="relative mx-auto max-w-[1344px]">
            <div className="text-center">
              <span className="inline-block rounded-full bg-[#008254]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#006642]">
                {t("nav.contact")}
              </span>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#071929] sm:text-3xl">
                Banking That Reaches Everyone, Safely
              </h2>
              <p className="mx-auto mt-2 max-w-2xl text-base text-[#55606C]">
                Built as a public-good academic innovation project for IIIT Dharwad, putting community security and honesty above all else.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className="rounded-2xl border border-[#ebebec] bg-[#f7f7f7] p-6 transition-[border-color,box-shadow] duration-150 hover:border-[#008254]/40 hover:shadow-sm">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#008254] text-white">
                  <ShieldCheck className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#071929]">Double-Entry Ledger</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#55606C]">
                  Every balance movement is backed by immutable ledger rows with guarded database transactions. An account can never be overdrawn, even under concurrency.
                </p>
              </div>

              <div className="rounded-2xl border border-[#ebebec] bg-[#f7f7f7] p-6 transition-[border-color,box-shadow] duration-150 hover:border-[#008254]/40 hover:shadow-sm">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#008254] text-white">
                  <MapPin className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#071929]">Local Banking Agents</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#55606C]">
                  Directory architecture designed for village correspondents to provide assisted deposits, cash-out points, and biometric KYC assistance for low-literacy users.
                </p>
              </div>

              <div className="rounded-2xl border border-[#ebebec] bg-[#f7f7f7] p-6 transition-[border-color,box-shadow] duration-150 hover:border-[#008254]/40 hover:shadow-sm">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#008254] text-white">
                  <Languages className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-[#071929]">Trilingual Accessibility</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#55606C]">
                  Full native interface available in English, हिन्दी (Hindi), and ಕನ್ನಡ (Kannada) with voice readout assistance for audio confirmation of financial balances.
                </p>
              </div>
            </div>

            <div className="mt-12 flex flex-col items-center justify-between gap-6 rounded-3xl bg-[#01322C] p-8 text-white sm:flex-row sm:p-10">
              <div>
                <h3 className="text-xl font-bold sm:text-2xl">Ready to experience cleaner, fairer banking?</h3>
                <p className="mt-1 text-sm text-[#C4D2CC]">
                  Built by students at IIIT Dharwad. Open questions? Email <span className="underline">finleaf@iiitdwd.ac.in</span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/about"
                  className="rounded-xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  Read Methodology
                </Link>
                <Link
                  href="/sign-in"
                  className="rounded-xl bg-[#008254] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#006642]"
                >
                  Create Account
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ============================================================ footer */}
      <footer className="relative bg-[#01322C]">
        <Image
          src="/landing/leaf-stats-right.png"
          alt=""
          width={78}
          height={64}
          unoptimized
          className="absolute right-0 top-[-65px] hidden sm:block"
        />
        <Image
          src="/landing/leaf-footer-left.png"
          alt=""
          width={90}
          height={74}
          unoptimized
          className="absolute left-0 top-[28px] hidden sm:block"
        />
        <Image
          src="/landing/leaf-footer-right.png"
          alt=""
          width={60}
          height={66}
          unoptimized
          className="absolute right-0 top-[36px] hidden sm:block"
        />

        <div className="relative mx-auto max-w-[1344px] px-4 py-8 desk:h-[118px] desk:p-0">
          <div className="flex flex-col items-center gap-6 text-center desk:block desk:text-left">
            <div className="flex w-full flex-col items-center justify-between gap-4 sm:flex-row desk:block">
              <Link
                href="/"
                aria-label={t("landing.logoAlt")}
                className="relative block h-14 w-[180px] sm:h-16 sm:w-[220px] desk:absolute desk:-left-px desk:-top-[4px] desk:h-20 desk:w-[260px]"
              >
                <Image
                  src="/landing/logo-footer.png"
                  alt=""
                  width={260}
                  height={80}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </Link>

              <nav
                aria-label={t("nav.home")}
                className="absolute left-1/2 top-[21px] ml-[-11px] hidden -translate-x-1/2 desk:block"
              >
                <ul className="flex items-center gap-[34px]">
                  {navItems.map((item) =>
                    "hash" in item ? (
                      <li key={item.hash}>
                        <a href={item.hash} className={footerNavClass}>
                          {item.label}
                        </a>
                      </li>
                    ) : (
                      <li key={item.href}>
                        <Link href={item.href} className={footerNavClass}>
                          {item.label}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </nav>

              <div className="flex items-center gap-[19px] desk:absolute desk:right-0 desk:top-[20px]">
                {socials.map((social) => (
                  <a
                    key={social.icon}
                    href="mailto:finleaf@iiitdwd.ac.in"
                    aria-label={social.label}
                    className="block h-10 w-10 transition-opacity hover:opacity-80"
                  >
                    <Image
                      src={social.icon}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-10 w-10"
                    />
                  </a>
                ))}
              </div>
            </div>

            <div className="h-px w-full max-w-[1213px] bg-[#0E4C40] desk:absolute desk:left-1/2 desk:top-[69px] desk:-translate-x-1/2" />

            <p className="text-[12.5px] leading-5 text-[#C1CEC8] desk:absolute desk:inset-x-0 desk:top-[77px] desk:text-center">
              {t("landing.footer.copyright")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
