"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { contributeToProjectAction } from "./offset-action";
import { formatCo2e } from "@/lib/i18n";

/**
 * Fund an offset project with green points.
 *
 * The cost of what the user is about to spend is shown before they commit, and
 * the already-funded total refreshes on the page. Points are deducted
 * atomically with the contribution: a user cannot be left having spent points
 * for a contribution that failed to record.
 */

interface State {
  error?: string;
  message?: string;
  contributed?: boolean;
}

const initialState: State = {};

export function OffsetForm({
  projectId,
  projectName,
  unit,
  costPoints,
  availablePoints,
  alreadyFunded,
}: {
  projectId: string;
  projectName: string;
  unit: string;
  costPoints: number;
  availablePoints: number;
  alreadyFunded: number;
}) {
  const [state, formAction, pending] = useActionState(contributeToProjectAction, initialState);
  const maxUnits = Math.floor(availablePoints / costPoints);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="projectId" value={projectId} />

      <p className="field-help">
        You have {availablePoints} green points · {costPoints} per {unit}
        {alreadyFunded > 0 ? ` · already funded ${formatCo2e(alreadyFunded, "en")}` : ""}
      </p>

      <Field
        label={`How many ${unit}s`}
        htmlFor={`units-${projectId}`}
        help={maxUnits === 0 ? "Not enough points yet" : `Up to ${maxUnits}`}
      >
        <input
          id={`units-${projectId}`}
          name="units"
          type="number"
          inputMode="numeric"
          min="1"
          max={Math.max(1, maxUnits)}
          defaultValue={Math.min(1, Math.max(1, maxUnits))}
          className="input tnum"
          disabled={maxUnits === 0}
          required
        />
      </Field>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}

      <Button type="submit" loading={pending} disabled={maxUnits === 0}>
        Fund {projectName}
      </Button>
    </form>
  );
}
