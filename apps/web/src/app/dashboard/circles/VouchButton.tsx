"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { vouchAction } from "./vouch-action";

/**
 * Vouch form.
 *
 * Opens inline rather than on a separate page, because vouching is a small act
 * that happens while looking at a member list. `canVouch` decides whether the
 * button is offered at all; it is a convenience, and the authorisation that
 * actually counts is in the action, which re-reads the circles from the
 * database rather than trusting the circle or member id in the form.
 */

interface State {
  error?: string;
  message?: string;
}

const initialState: State = {};

export function VouchButton({
  circleId,
  toUserId,
  toName,
  canVouch,
  reason,
}: {
  circleId: string;
  toUserId: string;
  toName: string;
  canVouch: boolean;
  reason?: string;
}) {
  const [state, formAction, pending] = useActionState(vouchAction, initialState);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="secondary"
        disabled={!canVouch}
        onClick={() => setOpen(true)}
      >
        {canVouch ? `Vouch for ${toName}` : (reason ?? "Vouch")}
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      <input type="hidden" name="circleId" value={circleId} />
      <input type="hidden" name="toUserId" value={toUserId} />
      <input type="hidden" name="weight" value="1" />

      <Field label="How do you know them" htmlFor={`vouch-note-${toUserId}`}>
        <input
          id={`vouch-note-${toUserId}`}
          name="note"
          type="text"
          maxLength={200}
          placeholder="Neighbour — pays back on time"
          className="input"
        />
      </Field>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={pending}>
          Vouch
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
