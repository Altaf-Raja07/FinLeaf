"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui";
import { exportStatement } from "./export-action";

/**
 * Download statement as CSV.
 *
 * The filters are passed through as they were applied server-side, so the
 * download always matches what the user is looking at — an export that silently
 * ignored the filters would be wrong in a way nobody would notice.
 */

export function ExportCsvButton({ where }: { where: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="secondary"
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          // Errors surface through the transition's own boundary; a rate limit
          // is the realistic case here.
          await exportStatement(where).catch(() => {
            alert("We could not generate that statement just now. Please try again.");
          });
        })
      }
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Download statement
    </Button>
  );
}
