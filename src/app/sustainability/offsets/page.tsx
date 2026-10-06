import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getOffsetProjects, getOffsetImpact } from "@/lib/screens";
import { getGreenPoints } from "@/lib/queries";
import { OffsetProjectCard } from "@/components/offset-project-card";
import { OffsetImpactSummary } from "@/components/offset-impact-summary";
import { AppShell, PageHeader } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function OffsetsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const [projects, points, impact] = await Promise.all([
    getOffsetProjects(),
    getGreenPoints(user.id),
    getOffsetImpact(user.id),
  ]);

  return (
    <AppShell pathname="/sustainability" userName={user.fullName}>
      <PageHeader title="Carbon offset projects" subtitle="Spend green points to fund verified local projects" />

      <OffsetImpactSummary impact={impact} />

      <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <OffsetProjectCard
            key={project.id}
            project={project}
            affordable={points.balance >= project.pointsCost}
          />
        ))}
      </div>
    </AppShell>
  );
}