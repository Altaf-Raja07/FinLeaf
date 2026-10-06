import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getGreenPoints } from "@/lib/queries";
import { getRewards } from "@/lib/screens";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, Pill } from "@/components/ui";
import { RedeemButton } from "@/components/reward-controls";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Green rewards.
 *
 * Small rewards (discounts, small donations) live here. The offset projects are a
 * separate page, because funding them is a different decision: it spends points on
 * a real-world outcome rather than on a discount, and the cards are wide enough to
 * need their own layout.
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
          <Link
            href="/sustainability/offsets"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 text-[15px] font-semibold text-white hover:bg-primary-hover"
          >
            Browse offset projects
          </Link>
        </div>
      </Card>
    </AppShell>
  );
}