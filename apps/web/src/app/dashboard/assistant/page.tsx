import { redirect } from "next/navigation";
import { PageHeader, Alert, Card, CardHeader } from "@/components/ui";
import { translator } from "@/lib/server-utils";
import { currentUser } from "@/lib/auth/session";
import { SUGGESTED_QUESTIONS } from "@/lib/assistant";
import { listConversation } from "./assistant-actions";
import { ChatPanel } from "./ChatPanel";

/**
 * Financial-literacy assistant.
 *
 * The disclosure at the top of the page is not a formality. This is a rule-based
 * matcher over the user's own rows, and saying otherwise would invite someone to
 * trust an answer it cannot actually give.
 */

export default async function AssistantPage() {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const { t, locale } = await translator();

  const [messages, suggested] = await Promise.all([
    listConversation(),
    Promise.resolve(SUGGESTED_QUESTIONS[locale]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("assistant.title")} subtitle={t("assistant.subtitle")} />

      <Alert tone="info" title={t("assistant.disclaimer")}>
        {t("assistant.intro")}
      </Alert>

      {messages.length === 0 ? (
        <Card>
          <CardHeader title={t("assistant.suggested")} />
          <ChatPanel locale={locale} suggested={suggested} initialMessages={[]} />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={t("assistant.history")}
            subtitle={t("assistant.subtitle")}
          />
          <ChatPanel locale={locale} suggested={suggested} initialMessages={messages} />
        </Card>
      )}
    </div>
  );
}
