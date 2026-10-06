/**
 * Card for a single carbon offset project.
 *
 * Three cards in a row, matching the reference layout. Outcome metrics are
 * shown as two lines under the project title with an icon token mapping.
 */
import { Card } from "@/components/ui";
import { TreeIcon, StoveIcon, WavesIcon, CloudIcon } from "@/components/icons";

const ICON_MAP = {
  tree: TreeIcon,
  stove: StoveIcon,
  waves: WavesIcon,
  cloud: CloudIcon,
};

export function OffsetProjectCard({ project, affordable }: {
  project: {
    id: number;
    code: string;
    title: string;
    location: string;
    pointsCost: number;
    co2eKg: number;
    metrics: Array<{ iconKey: string; label: string; value: string }>;
  };
  affordable: boolean;
}) {
  return (
    <Card className="p-5">
      <h3 className="text-[17px] font-bold tracking-tight">{project.title}</h3>
      <p className="text-[13px] text-muted mt-0.5">{project.location}</p>

      <div className="mt-2 space-y-1">
        {project.metrics.map((m) => {
          const Icon = ICON_MAP[m.iconKey as keyof typeof ICON_MAP] ?? TreeIcon;
          return (
            <div key={m.iconKey + m.label} className="flex items-center gap-2 text-[13px] text-muted">
              <Icon size={16} className="shrink-0 text-leaf" />
              <span>{m.label}: </span>
              <span className="fl-num font-medium text-foreground">{m.value}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="fl-num text-[15px] font-semibold text-leaf">{project.pointsCost} points</p>
          <p className="text-[12px] text-muted">About {Math.round(project.co2eKg / project.pointsCost * 100) / 100} kg CO2e per point</p>
        </div>
        <button
          type="button"
          disabled={!affordable}
          onClick={() => {
            alert(`Funded ${project.title} (${project.pointsCost} points)`);
          }}
          className={`inline-flex h-10 items-center justify-center rounded-md px-4 text-[14px] font-medium ${
            affordable
              ? "bg-green-800 text-white hover:bg-green-900"
              : "cursor-not-allowed bg-sunken text-muted opacity-60"
          }`}
        >
          {affordable ? "Fund with points" : "Points to go"}
        </button>
      </div>
    </Card>
  );
}