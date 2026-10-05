"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input } from "@/components/ui";

/**
 * Goal controls.
 *
 * ContributeButton disables itself while in flight and carries an idempotency
 * key, so a double-tap cannot record two contributions for one tap. The server
 * enforces the same rule independently.
 */

export function ContributeButton({
  goalId,
  amountPaise,
}: {
  goalId: number;
  amountPaise: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key] = useState(() => `gc-${goalId}-${Date.now().toString(36)}`);

  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/goals/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, amountPaise, idempotencyKey: key }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "We could not record that contribution.");
        return;
      }
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={submit} disabled={busy} className="min-w-[132px]">
        {busy ? "Saving…" : `Add ${(amountPaise / 100).toLocaleString("en-IN")}`}
      </Button>
      {error && (
        <span role="alert" className="text-[12px] font-medium text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

export function CreateGoalForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [weekly, setWeekly] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="lg" className="w-full sm:w-auto">
        Create a new goal
      </Button>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          targetRupees: Number(target),
          weeklyRupees: Number(weekly || 0),
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        if (payload?.error?.fields) setFieldErrors(payload.error.fields);
        else setError(payload?.error?.message ?? "We could not create that goal.");
        return;
      }
      setOpen(false);
      setTitle("");
      setTarget("");
      setWeekly("");
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-5">
      <Field label="What are you saving for" htmlFor="title" error={fieldErrors.title}>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="School fees for Meena"
          maxLength={80}
          required
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Target amount (₹)" htmlFor="target" error={fieldErrors.targetRupees}>
          <Input
            id="target"
            type="number"
            inputMode="decimal"
            min="1"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            required
          />
        </Field>
        <Field
          label="Save each week (₹, optional)"
          htmlFor="weekly"
          hint="Leave blank if you will add money manually"
          error={fieldErrors.weeklyRupees}
        >
          <Input
            id="weekly"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={weekly}
            onChange={(e) => setWeekly(e.target.value)}
          />
        </Field>
      </div>
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create goal"}
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}