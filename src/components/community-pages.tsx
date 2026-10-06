import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getFamilyGroup, getEndorsements, getAgents, getLessons, getBadges, getLeaderboard } from "@/lib/screens";
import { getTransactions } from "@/lib/queries";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState, IconTile, Notice, Pill } from "@/components/ui";
import { CategoryIcon, CheckIcon, GlobeIcon, LockIcon, MapPinIcon, PhoneIcon, UserIcon } from "@/components/icons";
import { Asset, LESSON_ASSET, EmptyStateArt } from "@/components/illustration";

export const dynamic = "force-dynamic";

/**
 * The remaining inclusion screens, grouped by the shared shell.
 *
 * They live together because they share one data-access pattern and one visual
 * language; each still has its own reference in design/ and its own route.
 */

export function metadata() {
  return { title: "Community" };
}

/* ---------------------------------------------------------------- family */

export async function FamilyPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const group = await getFamilyGroup(user.id);
  const { rows: activity } = await getTransactions(user.id, { limit: 40 });

  return (
    <AppShell pathname="/family" userName={user.fullName}>
      <PageHeader title="Family account" subtitle={group ? `${group.name} - shared visibility` : undefined} />

      {!group ? (
        <Card>
          <EmptyState title="No family group" body="A group lets several people see one household's money." />
        </Card>
      ) : (
        <>
          <Card className="p-5">
            <p className="text-[15px] font-semibold">Group balance</p>
            <p className="fl-num mt-2 text-[38px] leading-none font-semibold tracking-tight">
              ₹{(group.balance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
            <div className="mt-4 flex -space-x-2">
              {group.members.slice(0, 4).map((m) => (
                <span
                  key={m.userId}
                  title={m.name}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-surface bg-sunken text-[12px] font-semibold text-muted"
                >
                  {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
              ))}
            </div>
          </Card>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-[17px] font-semibold">Recent group activity</h2>
              <ul className="mt-3">
                {activity.slice(0, 4).map((row) => (
                  <li key={row.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                    <IconTile tone="neutral">
                      <CategoryIcon category={row.category} size={17} />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{row.merchant}</p>
                      <p className="text-[13px] text-muted">{row.category}</p>
                    </div>
                    <span className={`fl-num text-[14px] font-semibold ${row.direction === "credit" ? "text-leaf" : ""}`}>
                      {row.direction === "credit" ? "+" : "−"}₹
                      {(row.amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-5">
              <h2 className="text-[17px] font-semibold">Members</h2>
              <ul className="mt-3">
                {group.members.map((m) => (
                  <li key={m.userId} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
                    <IconTile tone="primary">
                      <UserIcon size={17} />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold">{m.name}</p>
                      <p className="text-[13px] text-muted">{m.role}</p>
                    </div>
                    <Pill tone="neutral">{m.visibility.replace("_", " ")}</Pill>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}

/* --------------------------------------------------------------- circle */

export async function CirclePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [endorsements, group] = await Promise.all([getEndorsements(user.id), getFamilyGroup(user.id)]);

  return (
    <AppShell pathname="/circle" userName={user.fullName}>
      <PageHeader
        title="Your trust circle"
        subtitle="Small peer groups that vouch for each other"
      />

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-[20px] font-semibold">Kudumb circle 04</h2>
            <p className="text-[13px] text-muted">
              {group ? group.members.length : 0} members - Dharwad district
            </p>
          </div>
          <div className="flex gap-6">
            {[
              { label: "Endorsements received", value: String(endorsements.length) },
              { label: "Group savings", value: "18,400" },
            ].map((s) => (
              <div key={s.label}>
                <p className="fl-num text-[20px] font-semibold">{s.value}</p>
                <p className="text-[12.5px] text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="px-5 pt-5">
          <h2 className="text-[17px] font-semibold">Endorsements</h2>
        </div>
        {endorsements.length === 0 ? (
          <EmptyState title="No endorsements yet" body="Circle members who trust you can endorse you here." />
        ) : (
          <ul>
            {endorsements.map((e) => (
              <li key={e.id} className="flex items-center gap-3.5 border-b border-border px-5 py-4 last:border-b-0">
                <IconTile tone="leaf">
                  <CheckIcon size={17} />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold">{e.fromName}</p>
                  <p className="truncate text-[13px] text-muted">{e.reason}</p>
                </div>
                <Pill tone="leaf">+{e.points} points</Pill>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4">
        <Notice tone="neutral">
          Endorsements adjust your trust score within a limit, and a member can withdraw theirs at
          any time.
        </Notice>
      </div>
    </AppShell>
  );
}

/* --------------------------------------------------------------- agents */

export async function AgentsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const agents = await getAgents(user.id);

  return (
    <AppShell pathname="/agents" userName={user.fullName}>
      <PageHeader title="Nearby agents and kiosks" subtitle="Cash deposit and withdrawal points near you" />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        {/* Generated illustration rather than an embedded map widget: no tile
            provider, no API key, and no third-party request. */}
        <Card className="overflow-hidden">
          <Asset
            name="agent-kiosk"
            width={1120}
            height={747}
            // Above the fold and the largest element on the page, so it must not
            // be lazy: it is the LCP element and deferring it delays first paint.
            priority
            sizes="(min-width: 1024px) 60vw, 100vw"
            className="w-full"
          />
        </Card>

        <Card className="p-5">
          <h2 className="text-[17px] font-semibold">{agents.length} places near you</h2>
          <ul className="mt-3">
            {agents.map((a) => (
              <li key={a.id} className="flex items-start gap-3 border-b border-border py-3 last:border-b-0">
                <IconTile tone="primary">
                  <MapPinIcon size={17} />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-semibold">{a.name}</p>
                  <p className="text-[13px] text-muted">
                    {a.distanceKm} km - open until {a.closesAt}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {agents.length === 0 && (
            <EmptyState title="No agents nearby" body="Try again once your location is known." />
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Notice tone="neutral">Agent locations are simulated for this prototype.</Notice>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------------- learn */

export async function LearnPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const [lessons, badges] = await Promise.all([getLessons(user.id), getBadges(user.id)]);
  const earned = badges.filter((b) => b.earned).length;

  return (
    <AppShell pathname="/learn" userName={user.fullName}>
      <PageHeader title="Money lessons" subtitle="Short reads in your language, with a quiz at the end" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lessons.map((lesson) => (
          <Card key={lesson.id} className="flex flex-col p-5">
            {/* Real generated illustration. A gradient placeholder was here
                before, which is exactly the substitution design-system.md
                section 7 forbids. */}
            {LESSON_ASSET[lesson.slug] && (
              <div className="mb-4 h-20 overflow-hidden rounded-md border border-border">
                <Asset
                  name={LESSON_ASSET[lesson.slug]}
                  width={640}
                  height={320}
                  // All three lesson cards sit in the first viewport, and the
                  // browser picks one as the LCP element. They are 7-8 KB each,
                  // so eager-loading all three is cheaper than the flash of a
                  // placeholder.
                  priority
                  sizes="(min-width: 768px) 30vw, 92vw"
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <h2 className="text-[16px] font-semibold">{lesson.title}</h2>
            <p className="mt-1 text-[13px] text-muted">{lesson.minutes} min read</p>
            <div className="mt-3">
              {lesson.passed ? (
                <Pill tone="leaf">Quiz passed</Pill>
              ) : lesson.attempts > 0 ? (
                <Pill tone="neutral">Quiz attempted</Pill>
              ) : (
                <Pill>Not started</Pill>
              )}
            </div>
            <Link
              href={`/learn/${lesson.slug}`}
              className="mt-4 text-[14px] font-medium text-primary"
            >
              {lesson.passed ? "Read again" : "Start lesson"}
            </Link>
          </Card>
        ))}
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-[17px] font-semibold">Your badges</h2>
        <div className="mt-4 flex flex-wrap gap-4">
          {badges.map((b) => (
            <div key={b.code} className="flex w-28 flex-col items-center gap-2 text-center">
              <span
                aria-hidden="true"
                className={`flex h-14 w-14 items-center justify-center rounded-full ${
                  b.earned ? "bg-primary-soft text-primary" : "bg-sunken text-muted"
                }`}
              >
                {b.earned ? <CheckIcon size={22} /> : <LockIcon size={20} />}
              </span>
              <span className="text-[12.5px] font-medium">{b.title}</span>
              <span className="sr-only">{b.earned ? "earned" : "locked"}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-muted">
          {earned} of {badges.length} badges earned.
        </p>
      </Card>
    </AppShell>
  );
}

/* ------------------------------------------------------------- settings */

export async function SettingsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const rows = [
    { label: "Personal details", note: "Name, phone, language", href: "/settings" },
    { label: "Language", note: `Currently ${user.language === "en" ? "English" : user.language}`, href: "/settings" },
    { label: "Accessibility", note: "Larger text, higher contrast, reduce motion", href: "/settings" },
    { label: "Notifications", note: "Transaction alerts and reminders", href: "/settings" },
  ];

  return (
    <AppShell pathname="/settings" userName={user.fullName}>
      <PageHeader title="Settings" subtitle="Your account, language, and accessibility preferences" />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <span
              aria-hidden="true"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-[18px] font-semibold text-primary"
            >
              {user.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
            </span>
            <div>
              <h2 className="text-[18px] font-semibold">{user.fullName}</h2>
              <p className="text-[13px] text-muted">{user.phone}</p>
              <div className="mt-1">
                <Pill tone="leaf">Verified demo account</Pill>
              </div>
            </div>
          </div>

          <ul className="mt-5">
            {rows.map((row) => (
              <li key={row.label} className="border-b border-border last:border-b-0">
                <Link href={row.href} className="flex items-center gap-3 py-4 hover:bg-sunken">
                  <IconTile tone="neutral">
                    {row.label === "Language" ? <GlobeIcon size={18} /> : <PhoneIcon size={18} />}
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">{row.label}</span>
                    <span className="block text-[13px] text-muted">{row.note}</span>
                  </span>
                  <Pill tone="neutral">Edit</Pill>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <h2 className="text-[17px] font-semibold">Session</h2>
            <p className="mt-1 text-[13px] text-muted">Signed in as {user.fullName}</p>
            <form action="/api/auth/signout" method="post" className="mt-4">
              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-danger text-[15px] font-semibold text-danger hover:bg-danger-soft"
              >
                Sign out
              </button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="text-[17px] font-semibold">Data and privacy</h2>
            <ul className="mt-3">
              {[
                "Passwords are hashed, never stored in plain text",
                "We never ask for real card or government ID details",
                "Scoring excludes gender, caste, and religion",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5 border-b border-border py-3 last:border-b-0">
                  <span className="mt-0.5 shrink-0 text-muted">
                    <LockIcon size={16} />
                  </span>
                  <span className="text-[13.5px]">{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <Notice tone="neutral">
                FinLeaf is a demonstration project and moves no real money.
              </Notice>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

/* ---------------------------------------------------------- leaderboard */

export async function LeaderboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const peers = await getLeaderboard(user.id);
  const average = peers.length
    ? peers.reduce((s, p) => s + p.kg, 0) / peers.length
    : 0;
  const you = peers.find((p) => p.isYou);

  return (
    <AppShell pathname="/sustainability" userName={user.fullName}>
      <PageHeader title="Your village comparison" subtitle="How your spending compares with people near you" />

      <Card className="overflow-hidden">
        <div className="px-5 pt-5">
          <h2 className="text-[17px] font-semibold">Dharwad district - October</h2>
        </div>
        {peers.length === 0 ? (
          <EmptyState title="No comparison yet" body="Once you spend this month, you appear here." />
        ) : (
          <ul>
            {peers.map((p) => (
              <li
                key={p.userId}
                className={`flex items-center gap-3.5 border-b border-border px-5 py-3.5 last:border-b-0 ${
                  p.isYou ? "bg-primary-soft" : ""
                }`}
              >
                <span className="fl-num w-5 shrink-0 text-[13px] font-semibold text-muted">
                  {p.rank}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {p.name}
                  {p.isYou && <span className="ml-2 text-[12.5px] font-medium text-primary">(You)</span>}
                </span>
                <span className="fl-num shrink-0 text-[14px]">{p.kg} kg</span>
                <span className="fl-num w-20 shrink-0 text-right text-[14px] text-muted">
                  {p.points.toLocaleString("en-IN")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { label: "You", value: you ? `${you.kg} kg` : "-" },
          { label: "Circle average", value: `${average.toFixed(1)} kg` },
          { label: "District average", value: "41.2 kg" },
        ].map((row) => (
          <Card key={row.label} className="p-5">
            <p className="text-[13px] text-muted">{row.label}</p>
            <p className="fl-num mt-1 text-[24px] font-semibold">{row.value}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <Notice tone="neutral">
          Comparisons use each person&rsquo;s estimated emissions for the current month, calculated from
          their own transactions.
        </Notice>
      </div>
    </AppShell>
  );
}