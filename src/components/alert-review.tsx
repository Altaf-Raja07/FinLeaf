"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card } from "@/components/ui";
import { CategoryIcon } from "@/components/icons";

/**
 * Confirm or dispute one flagged transaction.
 *
 * Both buttons are disabled while a request is in flight so a double tap cannot
 * record two different answers to the same alert.
 */
export function AlertReview({
  alert,
}: {
  alert: {
    id: number;
    score: number;
    reasons: string[];
    merchant: string | null;
    amount: number | null;
    category: string | null;
  };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(outcome: "confirmed" | "disputed") {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/anomalies/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alertId: alert.id, outcome }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setError(payload?.error?.message ?? "We could not record your answer.");
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
    <Card className="border-l-4 border-l-amber p-5">
      <div className="flex items-center gap-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-soft text-amber">
          <CategoryIcon category={alert.category ?? "transfer"} size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-semibold">{alert.merchant ?? "Transaction"}</p>
          <p className="text-[13px] text-muted">
            {alert.category} -{" "}
            {alert.amount !== null &&
              `₹${(alert.amount / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[13.5px] text-muted">
        Flagged because: {alert.reasons.join(" and ").toLowerCase()}. Your money was not blocked.
      </p>

      {error && (
        <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        <Button onClick={() => respond("confirmed")} disabled={busy}>
          {busy ? "Saving…" : "Yes, that was me"}
        </Button>
        <Button variant="danger" onClick={() => respond("disputed")} disabled={busy}>
          No, I did not do this
        </Button>
      </div>
    </Card>
  );
}