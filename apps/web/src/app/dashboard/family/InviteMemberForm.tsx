"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { inviteMemberAction } from "./family-action";

/**
 * Invite someone by phone.
 *
 * The result is a link, shown on screen. FinLeaf has no SMS channel that can
 * carry a link — the transports in src/lib/sms are OTP-shaped, and stretching
 * one to deliver an invite would produce a message that tells the recipient not
 * to share the very link they were sent. So the link is always displayed for
 * the inviter to hand over directly, and the copy explains which of the two
 * situations the deployment is in.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  inviteLink?: string;
  smsConfigured?: boolean;
}

const initialState: State = {};

export function InviteMemberForm({
  groupId,
  labels,
}: {
  groupId: string;
  labels: {
    invite: string;
    inviteHelp: string;
    phone: string;
    allowSpend: string;
    allowSpendHelp: string;
    linkTitle: string;
    linkHelpNoSms: string;
    linkHelpSms: string;
    copy: string;
    copied: string;
  };
}) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);
  const [copied, setCopied] = useState(false);
  const errors = state?.fieldErrors ?? {};

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="groupId" value={groupId} />

        <Field
          label={labels.phone}
          htmlFor={`invite-phone-${groupId}`}
          help={labels.inviteHelp}
          error={errors.phone}
          className="min-w-56 flex-1"
        >
          <input
            id={`invite-phone-${groupId}`}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            maxLength={20}
            placeholder="+919876543210"
            className="input tnum"
            required
          />
        </Field>

        <Field label={labels.allowSpend} htmlFor={`invite-spend-${groupId}`} className="min-w-56">
          <label className="flex items-center gap-2 text-sm">
            <input
              id={`invite-spend-${groupId}`}
              name="canSpend"
              type="checkbox"
              value="true"
              className="h-4 w-4"
            />
            <span>{labels.allowSpendHelp}</span>
          </label>
        </Field>

        <Button type="submit" loading={pending}>
          {labels.invite}
        </Button>
      </form>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}

      {state?.inviteLink ? (
        <div className="flex flex-col gap-2 rounded-card border border-rule bg-surface-sunken p-3">
          <p className="text-sm font-bold">{labels.linkTitle}</p>

          <div className="flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={state.inviteLink}
              aria-label={labels.linkTitle}
              className="input flex-1 text-sm"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(state.inviteLink ?? "")
                  .then(() => setCopied(true))
                  .catch(() => setCopied(false));
              }}
            >
              {copied ? labels.copied : labels.copy}
            </Button>
          </div>

          <p className="field-help">
            {state.smsConfigured
              ? labels.linkHelpSms
              : labels.linkHelpNoSms}{" "}
            This link expires in 7 days and works once. Anyone who has it can
            join your household group, so send it to one person, directly.
          </p>
        </div>
      ) : null}
    </div>
  );
}
