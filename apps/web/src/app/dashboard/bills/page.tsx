import { redirect } from "next/navigation";
import { Alert, Card, CardHeader } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { requireAccount } from "@/lib/auth/guard";
import { listBillers } from "@/lib/banking/bills";
import { BillPaymentForm } from "./BillPaymentForm";

/**
 * Bills and recharge.
 *
 * The "this does not pay a real bill" statement is a fixture of the page rather
 * than a footnote: FinLeaf has no operator integration, so the payment debits
 * the FinLeaf account and records a receipt. A user who believed their
 * electricity bill was settled because this page said so would be genuinely
 * harmed by it.
 */

export default async function BillsPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();
  const account = await requireAccount(user.id);
  const billers = await listBillers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("bills.title")}</h1>
        <p className="field-help mt-1">{t("bills.subtitle")}</p>
      </div>

      <Alert tone="warning" title={t("bills.estimateOnly")}>
        This page debits your FinLeaf account and gives you a receipt. It does
        not send money to the operator and does not settle a real utility,
        electricity or telecom bill.
      </Alert>

      {billers.length === 0 ? (
        <Card>
          <CardHeader title={t("bills.noBillers")} subtitle={t("bills.subtitle")} />
        </Card>
      ) : (
        <BillPaymentForm
          locale={locale}
          balance={account.balance.toString()}
          accountId={account.id}
          billers={billers.map((b) => ({
            slug: b.slug,
            name: b.name,
            category: b.category,
            requiresRef: b.requiresRef,
            refLabel: b.refLabel ?? "Reference number",
          }))}
        />
      )}

      <Card>
        <CardHeader title={t("bills.paperless")} />
        <p className="field-help">
          Paying here is recorded electronically, so the sheet count in your
          sustainability score goes up for each payment.
        </p>
      </Card>
    </div>
  );
}

