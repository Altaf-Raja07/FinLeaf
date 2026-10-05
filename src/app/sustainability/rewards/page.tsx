import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getGreenPoints } from "@/lib/queries";
import { getOffsetProjects, getRewards } from "@/lib/screens";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, EmptyState, Notice, Pill } from "@/components/ui";
import { RedeemButton, OffsetFundButton } from "@/components/reward-controls";

export const dynamic = "force-dynamic";

/**
 * Green rewards.
 *
 * The affordability of each reward comes from the real point balance, so a card
 * disables itself only when the user genuinely cannot afford it, and the reason
 * is shown rather than left unexplained.
 */

export default async function RewardsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [points, rewards] = await Promise.all([getGreenPoints(user.id), getRewards()]);
  const NEXT_THRESHOLD = 1500;
  const progress = Math.min(100, Math.round((points.balance / NEXT_THRESHOLD) * 100));

  return (
    <AppShell pathname="/sustainability" userName={user.fullName}>
      <PageHeader title="Green rewards" subtitle="Spend lower-carbon, earn green points" />

      <Card className="p-5">
        <p className="text-[15px] font-semibold">Your green points balance</p>
        <p className="fl-num mt-2 text-[40px] leading-none font-semibold tracking-tight">
          {points.balance.toLocaleString("en-IN")}
        </p>
        <p className="mt-1 text-[13px] text-muted">
          Next reward at {NEXT_THRESHOLD.toLocaleString("en-IN")} points
        </p>
        <div
          role="progressbar"
          aria-valuenow={points.balance}
          aria-valuemin={0}
          aria-valuemax={NEXT_THRESHOLD}
          aria-label="Progress to next reward"
          className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-sunken"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
      </Card>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {rewards.map((reward) => {
          const affordable = points.balance >= reward.pointsCost;
          const short = reward.pointsCost - points.balance;
          return (
            <Card key={reward.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-[16px] font-semibold">{reward.title}</h2>
                <Pill tone={reward.kind === "donation" ? "leaf" : "primary"}>{reward.kind}</Pill>
              </div>
              <p className="mt-1 text-[13px] text-muted">{reward.description}</p>
              <p className="fl-num mt-3 text-[20px] font-semibold text-leaf">
                {reward.pointsCost} points
              </p>
              <div className="mt-3">
                {affordable ? (
                  <RedeemButton rewardId={reward.id} pointsCost={reward.pointsCost} />
                ) : (
                  <>
                    <button
                      type="button"
                      disabled
                      className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center rounded-md border border-border-strong px-4 opacity-45"
                    >
                      {short} points to go
                    </button>
                    <p className="mt-1.5 text-center text-[12px] text-muted">
                      You need {short.toLocaleString("en-IN")} more points
                    </p>
                  </>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 p-5">
        <h2 className="text-[17px] font-semibold">Or fund something bigger</h2>
        <p className="mt-0.5 text-[13px] text-muted">
          Spend points on carbon offset projects instead of small discounts.
        </p>
        <div className="mt-4">
          <LinkToOffsets />
        </div>
      </Card>
    </AppShell>
  );
}

async function LinkToOffsets() {
  const user = await getSessionUser();
  const projects = await getOffsetProjects();
  if (!user) redirect("/login");
  const points = await getGreenPoints(user.id);

  if (projects.length === 0) {
    return <EmptyState title="No projects available" body="Offset projects will appear here." />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {projects.map((p) => (
        <div key={p.id} className="rounded-md border border-border p-4">
          <p className="text-[14.5px] font-semibold">{p.title}</p>
          <p className="text-[13px] text-muted">{p.location}</p>
          <p className="fl-num mt-2 text-[15px] font-semibold text-leaf">{p.pointsCost} points</p>
          <div className="mt-2">
            {points.balance >= p.pointsCost ? (
              <OffsetFundButton projectId={p.id} pointsCost={p.pointsCost} />
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-md border border-border-strong text-[13px] opacity-45"
              >
                {(p.pointsCost - points.balance).toLocaleString("en-IN")} points to go
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}