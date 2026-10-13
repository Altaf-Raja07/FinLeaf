import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui";
import { LeafMark } from "@/components/LeafMark";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { requireAccount } from "@/lib/auth/guard";
import { formatMoney } from "@/lib/i18n";
import { listBillers } from "@/lib/banking/bills";
import { deriveAnomalyFeatures } from "@/lib/banking/transfer";
import { TransferForm } from "./TransferForm";

/**
 * Send money.
 *
 * The form is a Client Component because it previews the recipient, the
 * estimated carbon and the anomaly explanation before the user commits. Those
 * three things have to be visible *before* sending: a payment that only reveals
 * its carbon cost afterwards is a payment nobody learns anything from.
 */

export default async function TransferPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t } = await translator();
  const account = await requireAccount(user.id);
  const billers = await listBillers();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("transfer.title")}</h1>
        <p className="field-help mt-1">{t("transfer.subtitle")}</p>
      </div>

      <Alert tone="info" title={t("transfer.estimateOnly")} icon={<LeafMark className="h-4 w-4" />}>
        <Link href="/methodology" className="font-semibold underline">
          {t("carbon.methodology")}
        </Link>
      </Alert>

      <TransferForm
        locale={user.preferredLang}
        balance={account.balance.toString()}
        accountId={account.id}
        accountNumber={account.number}
        billers={billers.map((b) => ({ slug: b.slug, name: b.name, category: b.category }))}
      />

      <p className="field-help text-balance">
        {t("bills.estimateOnly")}
      </p>
    </div>
  );
}

export { formatMoney };
