import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Play, Search } from "lucide-react";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";

/**
 * Public landing page.
 *
 * Laid out to match design/HomePage.png. The mockup is a 1536x1024 capture
 * whose live page area is the box x=10..1524 (the black strip on the left and
 * grey strip on the right are capture artifacts). Every offset below is stated
 * in those mockup coordinates so the numbers can be re-checked against the
 * design; the reference viewport is 1514px wide.
 *
 * Some parts of the design cannot be rebuilt from primitives — the hero's
 * composited photo, the brand lockup, the illustrated icons and the leaf
 * decorations — so they ship as image crops in `public/landing/`. They are
 * placed at the exact coordinates they were cropped from, which is what keeps
 * them pixel-aligned.
 */
export default async function HomePage() {
  const { t } = await translator();

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
    { label: t("nav.how"), href: "/methodology" as const },
    { label: t("nav.impact"), hash: "#impact" as const },
    { label: t("nav.demo"), href: "/sign-in" as const },
    { label: t("nav.contact"), href: "/about#contact" as const },
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
    <div className="min-h-screen bg-white text-[#091B27] desk:pl-[6px]">
      {/* ================================================================ header */}
      <header className="relative z-20 h-20 bg-white">
        <div className="relative mx-auto h-full w-full max-w-[1344px]">
          <Link
            href="/"
            aria-label={t("landing.logoAlt")}
            className="absolute -left-px top-1 block h-[76px] w-[260px]"
          >
            <Image
              src="/landing/logo-header.png"
              alt=""
              width={260}
              height={76}
              priority
              unoptimized
              className="h-[76px] w-[260px]"
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

          <div className="absolute right-0 top-[15px] flex items-center">
            <button
              type="button"
              aria-label={t("nav.search")}
              className="grid h-10 w-10 place-items-center rounded-full bg-[#F1F6F3] text-[#0E3A2A] transition-colors hover:bg-[#E6F2EC]"
            >
              <Search className="h-4 w-4" strokeWidth={2.4} />
            </button>
            <Link
              href="/sign-in"
              className="ml-[14px] grid h-[42px] place-items-center rounded-[10px] border border-[#D3E5DC] bg-white px-[25px] text-[14.5px] font-semibold text-[#077443] transition-colors hover:border-[#077443]"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/sign-in"
              className="ml-[17px] grid h-[42px] place-items-center rounded-xl bg-[#077443] px-[30.5px] text-[14.5px] font-semibold text-white transition-colors hover:bg-[#055F36]"
            >
              {t("landing.hero.getStarted")}
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* ============================================================== hero */}
        <section className="relative bg-gradient-to-b from-[#FBFDFB] to-[#F2F9F3] desk:h-[450px]">
          <Image
            src="/landing/hero-visual.png"
            alt={t("landing.hero.visualAlt")}
            width={860}
            height={450}
            priority
            className="absolute right-0 top-0 hidden h-[450px] w-[860px] desk:block"
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

        {/* ======================================================== set stats */}
        <section id="impact" className="bg-white">
          <div className="relative mx-auto max-w-[1344px] pb-[12px] pt-[20px]">
            <h2 className="text-center text-[25px] font-bold leading-[30px] text-[#071929]">
              {t("landing.problems.title")}
            </h2>

            <div className="mt-[8px] grid grid-cols-1 gap-[15px] min-[768px]:grid-cols-2 min-[1280px]:grid-cols-4 desk:grid-cols-[338px_316px_315px_330px]">
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
          className="absolute right-0 top-[-65px]"
        />
        <Image
          src="/landing/leaf-footer-left.png"
          alt=""
          width={90}
          height={74}
          unoptimized
          className="absolute left-0 top-[28px]"
        />
        <Image
          src="/landing/leaf-footer-right.png"
          alt=""
          width={60}
          height={66}
          unoptimized
          className="absolute right-0 top-[36px]"
        />

        <div className="relative mx-auto h-[118px] max-w-[1344px]">
          <Link
            href="/"
            aria-label={t("landing.logoAlt")}
            className="absolute -left-px -top-[4px] block h-20 w-[260px]"
          >
            <Image
              src="/landing/logo-footer.png"
              alt=""
              width={260}
              height={80}
              unoptimized
              className="h-20 w-[260px]"
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

          <div className="absolute right-0 top-[20px] flex items-center gap-[19px]">
            {socials.map((social) => (
              <a
                key={social.icon}
                href="mailto:finleaf@iiitdwd.ac.in"
                aria-label={social.label}
                className="block h-10 w-10"
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

          <div className="absolute left-1/2 top-[69px] h-px w-[1213px] -translate-x-1/2 bg-[#0E4C40]" />

          <p className="absolute inset-x-0 top-[77px] text-center text-[12.5px] leading-5 text-[#C1CEC8]">
            {t("landing.footer.copyright")}
          </p>
        </div>
      </footer>
    </div>
  );
}
