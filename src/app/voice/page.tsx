import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Card, Notice } from "@/components/ui";
import { VoicePanel } from "@/components/voice-panel";

export const dynamic = "force-dynamic";

/**
 * Voice assistant.
 *
 * Uses the browser's own Web Speech API, so no audio is sent to a server. Every
 * capability failure is handled in the panel with a route back to typing, because
 * a dead microphone with no explanation is worse for this audience than no
 * microphone feature at all.
 */
export default async function VoicePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <AppShell pathname="/learn" userName={user.fullName}>
      <PageHeader title="Voice assistant" subtitle="Ask about your money by speaking" />

      <div className="mx-auto max-w-[680px]">
        <Card>
          <VoicePanel />
        </Card>

        <div className="mt-4">
          <Notice tone="neutral">
            Speech recognition is provided by your browser, and no audio is recorded or sent anywhere.
            Answers are computed from your own account data on this server.
          </Notice>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-[14px]">
          <Link href="/chatbot" className="font-medium text-primary">
            Prefer to type? Use the text assistant
          </Link>
          <Link href="/dashboard" className="font-medium text-primary">
            Back to dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}