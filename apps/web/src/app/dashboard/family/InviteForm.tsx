"use client";

import { useActionState, useState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { translate, type Locale } from "@/lib/i18n";
import { inviteMemberAction } from "./family-actions";

/**
 * Invite form.
 *
 * The invite link is the only way in and it is single-use. It is shown to the
 * person who created it — to copy and share however they like — rather than sent
 * by SMS, because there is no message template for invites, and a link in an SMS
 * is the phishing pattern this product should not imitate.
 */

interface State {
  error?: string;
  message?: string;
  inviteLink?: string;
}

const initialState: State = {};

export function InviteForm({ groupId, locale }: { groupId: string; locale: Locale }) {
  const [state, formAction, pending] = useActionState(inviteMemberAction, initialState);
  const [copied, setCopied] = useState(false);

  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  return (
    <div className="flex flex-col gap-3">
      <p className="field-label">{t("family.inviteByPhone")}</p>

      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="groupId" value={groupId} />

        <Field
          label={t("family.phone")}
          htmlFor={`invite-phone-${groupId}`}
          help={t("family.phoneHelp")}
          className="min-w-60 flex-1"
        >
          <input
            id={`invite-phone-${groupId}`}
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="+919876543210"
            className="input"
            required
          />
        </Field>

        <label className="flex items-center gap-2 pb-3">
          <input type="checkbox" name="canSpend" className="h-4 w-4" />
          <span className="text-sm">{t("family.grantSpend")}</span>
        </label>

        <Button type="submit" loading={pending}>
          {t("family.sendInvite")}
        </Button>
      </form>

      {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}

      {state?.inviteLink ? (
        <div className="card-quiet flex flex-wrap items-center gap-2">
          <code className="flex-1 break-all font-mono text-xs">
            {state.inviteLink}
          </code>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard
                .writeText(state.inviteLink!)
                .then(() => setCopied(true))
                .catch(() => {
                  // A clipboard that is unavailable (insecure context, denied
                  // permission) must not break the flow: the link is still on
                  // screen and selectable.
                });
            }}
          >
            {copied ? t("action.copied") : t("action.copy")}
          </Button>
        </div>
      ) : null}

      <p className="field-help">{t("family.linkSingleUse")}</p>
    </div>
  );
}
