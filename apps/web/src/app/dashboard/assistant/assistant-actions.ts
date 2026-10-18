"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth/session";
import { answerQuestion } from "@/lib/assistant";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { chatSchema } from "@/lib/validation";
import type { ChatRole } from "@/generated/prisma/enums";

/**
 * Assistant actions.
 *
 * The conversation is stored, which is a deliberate feature rather than
 * telemetry: a user returning to a question needs to see what they asked. It is
 * also the reason every answer is computed at request time — a stored answer
 * about a balance would be wrong the moment that balance moved.
 */

export interface ChatState {
  error?: string;
  reply?: { text: string; fromAccount: boolean };
}

export async function askAssistant(
  _prev: ChatState,
  formData: FormData,
): Promise<ChatState> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  const parsed = chatSchema.safeParse({
    message: String(formData.get("message") ?? ""),
    locale: String(formData.get("locale") ?? "en"),
  });

  if (!parsed.success) {
    return { error: "Type a question to ask." };
  }

  const limited = await rateLimit(`chat:user:${user.id}`, RATE_LIMITS.chatbot);
  if (!limited.allowed) {
    return { error: "You are asking very quickly. Wait a moment and try again." };
  }

  const answer = await answerQuestion({
    userId: user.id,
    locale: parsed.data.locale,
    question: parsed.data.message,
  });

  // The question and its answer are written together, so the history never shows
  // a question with no reply if the two are asked at the same moment.
  await prisma.$transaction([
    prisma.chatMessage.create({
      data: { userId: user.id, role: "USER" as ChatRole, text: parsed.data.message },
    }),
    prisma.chatMessage.create({
      data: {
        userId: user.id,
        role: "ASSISTANT" as ChatRole,
        text: answer.text,
        intent: answer.intent,
      },
    }),
  ]);

  revalidatePath("/dashboard/assistant", "page");

  return {
    reply: { text: answer.text, fromAccount: answer.fromAccount },
  };
}

export async function clearConversation(): Promise<void> {
  const user = await currentUser();
  if (!user) redirect("/sign-in");

  await prisma.chatMessage.deleteMany({ where: { userId: user.id } });

  revalidatePath("/dashboard/assistant", "page");
}

/**
 * Previous exchanges, oldest first so the conversation reads top to bottom.
 *
 * Capped at 40 messages: the scroll position matters more than completeness, and
 * a user who wants their full history has the statements export.
 *
 * The subject comes from the session, never from an argument: every export of a
 * `"use server"` module is a remotely callable endpoint, so a `userId` parameter
 * here would let anyone read another user's conversation.
 */
export async function listConversation() {
  const user = await currentUser();
  if (!user) return [];

  const messages = await prisma.chatMessage.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, role: true, text: true, createdAt: true },
  });

  return messages.reverse();
}
