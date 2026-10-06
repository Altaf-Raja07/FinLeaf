import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, Notice } from "@/components/ui";
import { ChatPanel } from "@/components/chat-panel";

export const dynamic = "force-dynamic";

/**
 * Financial literacy assistant.
 *
 * Shares its intent resolver with the voice screen, so the two cannot give
 * different answers to the same question.
 */
export default async function ChatbotPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell pathname="/learn" userName={user.fullName}>
      <PageHeader title="Ask FinLeaf" subtitle="Plain-language answers about saving, borrowing, and avoiding fraud" />

      <div className="mx-auto max-w-[680px]">
        <Card className="overflow-hidden">
          <ChatPanel />
        </Card>
        <div className="mt-4">
          <Notice tone="neutral">
            Answers come from a fixed set of rules checked against your own account data. Nothing you
            type is sent to a third party, and the assistant cannot perform transactions.
          </Notice>
        </div>
        <div className="mt-4">
          <Link href="/learn" className="text-[14px] font-medium text-primary">
            Back to lessons
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
