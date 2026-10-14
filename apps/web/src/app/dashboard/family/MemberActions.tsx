"use client";

import { useActionState } from "react";
import { Alert, Button } from "@/components/ui";
import {
  leaveFamilyGroupAction,
  removeMemberAction,
  setMemberCanSpendAction,
} from "./family-action";

/**
 * The owner's controls over one member, and a member's way out.
 *
 * These are separate forms rather than one form with several buttons, because a
 * form posts everything it contains: a single "permissions" form would need a
 * hidden action field, and a mistyped one would remove a member instead of
 * toggling a flag.
 */

interface State {
  error?: string;
  message?: string;
}

const initialState: State = {};

/** Owner-only: flip a member's spending permission. */
export function ToggleSpendButton({
  groupId,
  memberId,
  canSpend,
  labels,
}: {
  groupId: string;
  memberId: string;
  canSpend: boolean;
  labels: { giveSpend: string; makeViewOnly: string; updated: string };
}) {
  const [state, formAction, pending] = useActionState(setMemberCanSpendAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="canSpend" value={canSpend ? "false" : "true"} />

      <Button
        type="submit"
        variant="ghost"
        loading={pending}
        aria-label={canSpend ? labels.makeViewOnly : labels.giveSpend}
      >
        {canSpend ? labels.makeViewOnly : labels.giveSpend}
      </Button>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? (
        <span className="field-help text-leaf-700">{labels.updated}</span>
      ) : null}
    </form>
  );
}

/** Owner-only: remove a member from the group. */
export function RemoveMemberButton({
  groupId,
  memberId,
  labels,
}: {
  groupId: string;
  memberId: string;
  labels: { remove: string; removed: string };
}) {
  const [state, formAction, pending] = useActionState(removeMemberAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="memberId" value={memberId} />

      <Button type="submit" variant="ghost" loading={pending}>
        {labels.remove}
      </Button>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? (
        <span className="field-help text-leaf-700">{labels.removed}</span>
      ) : null}
    </form>
  );
}

/** A member leaving a group they were invited into. */
export function LeaveGroupButton({
  groupId,
  labels,
}: {
  groupId: string;
  labels: { leave: string; left: string };
}) {
  const [state, formAction, pending] = useActionState(leaveFamilyGroupAction, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="groupId" value={groupId} />

      <Button type="submit" variant="ghost" loading={pending}>
        {labels.leave}
      </Button>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? (
        <span className="field-help text-leaf-700">{labels.left}</span>
      ) : null}
    </form>
  );
}
