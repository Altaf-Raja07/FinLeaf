"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import { vouchForMemberAction } from "./circle-action";

/**
 * Vouch for one member of one circle.
 *
 * There is no weight and no note in the interface even though the schema stores
 * both: a vouch is a yes or a no, and a six-level selector would invite people
 * to trade intensity for effect on a score it does not actually move.
 */

interface State {
  error?: string;
  message?: string;
}

const initialState: State = {};

export function VouchButton({
  circleId,
  toUserId,
  alreadyVouched,
  label,
}: {
  circleId: string;
  toUserId: string;
  alreadyVouched: boolean;
  label: string;
}) {
  const [state, formAction, pending] = useActionState(vouchForMemberAction, initialState);

  if (alreadyVouched) {
    return (
      <p className="field-help text-leaf-700" aria-live="polite">
        ✓ {label}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="toUserId" value={toUserId} />
      <Button type="submit" variant="secondary" loading={pending}>
        {label}
      </Button>
      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? (
        <span className="field-help text-leaf-700">{state.message}</span>
      ) : null}
    </form>
  );
}
