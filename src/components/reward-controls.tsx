"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";

/**
 * Redemption controls.
 *
 * Both disable while in flight and carry an idempotency key, so a double tap
 * cannot spend the same points twice. The server re-checks the balance inside a
 * transaction with a row lock, so the guard does not rely on the client.
 */

export function RedeemButton({ rewardId, pointsCost }: { rewardId: number; pointsCost: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [key] = useState(() => `rw-${rewardId}-${Date.now().toString(36)}`);

  async function submit() {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/rewards/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId, idempotencyKey: key }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "We could not complete that redemption.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="text-[13px] font-medium text-leaf">Redeemed. Points deducted.</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <Button onClick={submit} disabled={busy} variant="secondary" className="w-full">
        {busy ? "Redeeming…" : `Redeem ${pointsCost} points`}
      </Button>
      {error && (
        <p role="alert" className="text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function OffsetFundButton({ projectId }: { projectId: number; pointsCost: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [key] = useState(() => `of-${projectId}-${Date.now().toString(36)}`);

  async function submit() {
    if (busy || done) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/offsets/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, idempotencyKey: key }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "We could not fund that project.");
        return;
      }
      setDone(true);
      router.refresh();
    } catch {
      setError("We could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="text-[13px] font-medium text-leaf">Funded. Thank you.</p>;
  }

  return (
    <div>
      <Button onClick={submit} disabled={busy} size="md" className="w-full">
        {busy ? "Funding…" : "Fund with points"}
      </Button>
      {error && (
        <p role="alert" className="mt-1 text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}