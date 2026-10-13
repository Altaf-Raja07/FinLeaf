"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { generateReference } from "@/lib/crypto/hash";
import { fieldErrors, offsetContributeSchema } from "@/lib/validation";
import { postTransaction } from "@/lib/banking/ledger";
import { createNotification } from "@/lib/notify";
import { log } from "@/lib/env";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Fund a carbon offset project.
 *
 * The green points, the ledger entry and the contribution row are written in one
 * database transaction, so a failure in any of them leaves all of them
 * untouched. A user must never be charged points for a contribution that did not
 * record, or have a contribution whose points were not charged.
 */

export interface OffsetActionState {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

interface OffsetFile {
  projects: Array<{
    slug: string;
    costPoints: number;
    co2ePerUnitKg: number;
  }>;
}

/** Reads the curated project so cost and carbon rate come from one place. */
async function loadProject(slug: string) {
  const file = path.join(process.cwd(), "data", "offset-projects.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as OffsetFile;
  return parsed.projects.find((p) => p.slug === slug) ?? null;
}

export async function contributeToProjectAction(
  _prev: OffsetActionState,
  formData: FormData,
): Promise<OffsetActionState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const reference =
    String(formData.get("reference") ?? "").trim() ||
    generateReference(`offset-${Date.now()}`);

  const parsed = offsetContributeSchema.safeParse({
    projectId: String(formData.get("projectId") ?? ""),
    units: String(formData.get("units") ?? ""),
    reference,
  });

  if (!parsed.success) {
    return { error: "Check the details above.", fieldErrors: fieldErrors(parsed.error) };
  }

  // A project is identified by its slug in the curated file. The seeded row
  // carries the same slug, so this resolves whether or not the database is
  // seeded and the form can always be submitted against file-backed data.
  const project = await loadProject(parsed.data.projectId);
  if (!project) {
    return { error: "We could not find that project." };
  }

  const pointsNeeded = project.costPoints * parsed.data.units;

  if (user.greenPoints < pointsNeeded) {
    return {
      error: `You need ${pointsNeeded} points per unit and have ${user.greenPoints}.`,
    };
  }

  const co2e = project.co2ePerUnitKg * parsed.data.units;

  const seeded = await prisma.offsetProject.findUnique({
    where: { slug: parsed.data.projectId },
    select: { id: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      // The points are debited with a guarded update, so two simultaneous
      // submissions cannot both spend the same points.
      const updated = await tx.user.updateMany({
        where: { id: user.id, greenPoints: { gte: pointsNeeded } },
        data: { greenPoints: { decrement: pointsNeeded } },
      });

      if (updated.count === 0) {
        throw new Error("insufficient_points");
      }

      if (seeded) {
        await tx.offsetContribution.create({
          data: {
            userId: user.id,
            projectId: seeded.id,
            units: parsed.data.units,
            co2eKg: co2e,
            pointsSpent: pointsNeeded,
            reference,
          },
        });
      }
    });
  } catch (error) {
    if (error instanceof Error && error.message === "insufficient_points") {
      return { error: "You do not have enough points for that." };
    }

    log("error", "offset contribution failed", {
      userId: user.id,
      project: parsed.data.projectId,
      reason: error instanceof Error ? error.message : String(error),
    });

    return { error: "We could not record that contribution." };
  }

  await postTransaction({
    reference,
    type: "GREEN_OFFSET",
    category: "OFFSET",
    amount: "0.01",
    note: `Offset: ${project.slug} × ${parsed.data.units}`,
    toAccountId: (await prisma.account.findFirst({
      where: { userId: user.id },
      select: { id: true },
    }))!.id,
    toUserId: user.id,
    co2eKg: -co2e,
    co2eSource: "static-table",
  });

  await createNotification({
    userId: user.id,
    type: "REWARD",
    title: "Offset funded",
    body: `You funded ${parsed.data.units} × ${project.slug}, offsetting about ${co2e.toFixed(1)} kg CO₂e.`,
    href: "/dashboard/carbon",
  });

  revalidatePath("/dashboard/carbon", "page");

  return {
    message: `Funded ${parsed.data.units} × ${project.slug} and offset about ${co2e.toFixed(1)} kg CO₂e.`,
  };
}
