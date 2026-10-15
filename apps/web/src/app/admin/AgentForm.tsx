"use client";

import { useActionState } from "react";
import { Alert, Button, Field } from "@/components/ui";
import { createAgentAction } from "./admin-actions";

/**
 * Add an agent to the published directory.
 *
 * Coordinates are plain number inputs rather than a map picker, because the
 * operator has the coordinates from their own register and a map on an admin
 * screen invites the wrong kind of precision. The help text is explicit that the
 * record is published only with the operator's confirmation — this form writes
 * to a public directory of phone numbers, so that is the one sentence it must
 * not omit.
 */

interface State {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

const initialState: State = {};

export function AgentForm({
  labels,
}: {
  labels: {
    addAgent: string;
    agentName: string;
    shopName: string;
    village: string;
    agentPhone: string;
    latitude: string;
    longitude: string;
    openHours: string;
    agentHelp: string;
    phoneHelp: string;
  };
}) {
  const [state, formAction, pending] = useActionState(createAgentAction, initialState);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="field-help text-pretty">{labels.agentHelp}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.agentName} htmlFor="agent-name" error={errors.name}>
          <input id="agent-name" name="name" className="input" required maxLength={80} />
        </Field>

        <Field label={labels.shopName} htmlFor="agent-shop" error={errors.shopName}>
          <input id="agent-shop" name="shopName" className="input" required maxLength={120} />
        </Field>

        <Field label={labels.village} htmlFor="agent-village" error={errors.village}>
          <input id="agent-village" name="village" className="input" required maxLength={80} />
        </Field>

        <Field
          label={labels.agentPhone}
          htmlFor="agent-phone"
          help={labels.phoneHelp}
          error={errors.phone}
        >
          <input
            id="agent-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="+919876543210"
            className="input"
            required
          />
        </Field>

        <Field label={labels.latitude} htmlFor="agent-lat" error={errors.latitude}>
          <input
            id="agent-lat"
            name="latitude"
            type="number"
            step="any"
            min={-90}
            max={90}
            className="input"
            required
          />
        </Field>

        <Field label={labels.longitude} htmlFor="agent-lng" error={errors.longitude}>
          <input
            id="agent-lng"
            name="longitude"
            type="number"
            step="any"
            min={-180}
            max={180}
            className="input"
            required
          />
        </Field>

        <Field
          label={labels.openHours}
          htmlFor="agent-hours"
          error={errors.openHours}
          className="sm:col-span-2"
        >
          <input
            id="agent-hours"
            name="openHours"
            placeholder="Mon-Sat 09:00-18:00"
            className="input"
            required
            maxLength={80}
          />
        </Field>
      </div>

      {state?.error && !Object.keys(errors).length ? (
        <Alert tone="danger">{state.error}</Alert>
      ) : null}

      {state?.message ? <Alert tone="success">{state.message}</Alert> : null}

      <div>
        <Button type="submit" loading={pending}>
          {labels.addAgent}
        </Button>
      </div>
    </form>
  );
}
