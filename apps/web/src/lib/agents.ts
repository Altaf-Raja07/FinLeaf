import "server-only";
import { prisma } from "@/lib/db";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Banking Correspondent (BC) agent directory.
 *
 * `data/agents.json` ships **empty**, and that is deliberate. Inventing agent
 * names, shop names and phone numbers would put a real person's contact details
 * in front of a user looking for somewhere to deposit cash — and the number
 * would belong to a stranger, not to a banking service. It would also be
 * fabricated personal data about identifiable individuals.
 *
 * So the directory is operator-supplied. In a real deployment the BC network
 * operator loads their own records, because only they know who is authorised to
 * accept deposits and withdrawals.
 */

export interface AgentView {
  id: string;
  name: string;
  shopName: string;
  village: string;
  phone: string;
  latitude: number;
  longitude: number;
  openHours: string;
}

/** Reads the curated file. The database is the seeded mirror of it. */
export async function listAgents(
  options: { village?: string; query?: string } = {},
): Promise<AgentView[]> {
  const rows = await prisma.agent.findMany({
    where: {
      active: true,
      ...(options.village
        ? { village: { equals: options.village.trim(), mode: "insensitive" as const } }
        : {}),
      ...(options.query
        ? {
            OR: [
              { village: { contains: options.query.trim(), mode: "insensitive" as const } },
              { shopName: { contains: options.query.trim(), mode: "insensitive" as const } },
              { name: { contains: options.query.trim(), mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ village: "asc" }, { name: "asc" }],
  });

  if (rows.length > 0) {
    return rows.map(mapRow);
  }

  // Nothing seeded: fall back to the curated file, which is empty by default and
  // whatever the operator has committed after that.
  const file = path.join(process.cwd(), "data", "agents.json");
  const parsed = JSON.parse(await readFile(file, "utf8")) as
    { agents: AgentView[] };

  const agents = parsed.agents ?? [];

  return agents
    .filter((agent) =>
      options.village
        ? agent.village.toLowerCase() === options.village.trim().toLowerCase()
        : true,
    )
    .filter((agent) => {
      const q = options.query?.trim().toLowerCase();
      if (!q) return true;
      return (
        agent.village.toLowerCase().includes(q) ||
        agent.shopName.toLowerCase().includes(q) ||
        agent.name.toLowerCase().includes(q)
      );
    });
}

/** Authoritative write path, used by the admin route. */
export async function createAgent(input: {
  name: string;
  shopName: string;
  village: string;
  phone: string;
  latitude: number;
  longitude: number;
  openHours: string;
}): Promise<AgentView> {
  const agent = await prisma.agent.create({
    data: { ...input, active: true },
  });

  return mapRow(agent);
}

export async function deactivateAgent(id: string): Promise<void> {
  await prisma.agent.updateMany({
    where: { id },
    data: { active: false },
  });
}

/** Great-circle distance in kilometres, for the optional distance sort. */
export function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(to.latitude - from.latitude);
  const dLon = toRad(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapRow(row: {
  id: string;
  name: string;
  shopName: string;
  village: string;
  phone: string;
  latitude: number;
  longitude: number;
  openHours: string;
}): AgentView {
  return {
    id: row.id,
    name: row.name,
    shopName: row.shopName,
    village: row.village,
    phone: row.phone,
    latitude: row.latitude,
    longitude: row.longitude,
    openHours: row.openHours,
  };
}
