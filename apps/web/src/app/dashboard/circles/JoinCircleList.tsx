"use client";

import { useActionState } from "react";
import { Alert, Button, EmptyState } from "@/components/ui";
import { joinCircleAction } from "./circle-action";

/**
 * Circles in my village that I have not joined yet.
 *
 * One row per circle with its own action state, so joining one circle does not
 * blank out the rest of the list while the request is in flight.
 */

interface State {
  error?: string;
  message?: string;
}

const initialState: State = {};

export interface JoinCircleLabels {
  join: string;
  members: string;
  empty: string;
}

export function JoinCircleList({
  circles,
  labels,
}: {
  circles: Array<{ id: string; name: string; village: string; memberCount: number }>;
  labels: JoinCircleLabels;
}) {
  if (circles.length === 0) {
    return <EmptyState title={labels.empty} />;
  }

  return (
    <ul className="flex flex-col divide-y divide-rule">
      {circles.map((circle) => (
        <JoinCircleRow key={circle.id} circle={circle} labels={labels} />
      ))}
    </ul>
  );
}

function JoinCircleRow({
  circle,
  labels,
}: {
  circle: { id: string; name: string; village: string; memberCount: number };
  labels: JoinCircleLabels;
}) {
  const [state, formAction, pending] = useActionState(joinCircleAction, initialState);

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-semibold truncate">{circle.name}</p>
        <p className="field-help">
          {circle.village} ·{" "}
          {labels.members.replace("{count}", String(circle.memberCount))}
        </p>
      </div>

      <form action={formAction} className="flex items-center gap-3">
        <input type="hidden" name="circleId" value={circle.id} />
        {state?.error ? (
          <Alert tone="danger" className="max-w-xs">
            {state.error}
          </Alert>
        ) : null}
        {state?.message ? (
          <Alert tone="success" className="max-w-xs">
            {state.message}
          </Alert>
        ) : null}
        <Button type="submit" variant="secondary" loading={pending}>
          {labels.join}
        </Button>
      </form>
    </li>
  );
}
