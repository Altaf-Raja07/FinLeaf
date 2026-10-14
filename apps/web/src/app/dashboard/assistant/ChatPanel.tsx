"use client";

import { useActionState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Field } from "@/components/ui";
import { askAssistant, clearConversation } from "./assistant-actions";
import type { Locale } from "@/lib/i18n";

/**
 * Chat panel.
 *
 * The answer appears immediately from the action's returned state, and the
 * persisted history re-renders on the next request — which is why the panel
 * shows the reply without needing the page to reload, and why a refresh shows
 * the same conversation.
 *
 * Auto-scroll keeps the newest message in view. It is the one behaviour a user
 * will notice missing, because a chat panel that does not scroll to the reply
 * looks broken on a phone.
 */

interface Message {
  id: string;
  role: "USER" | "ASSISTANT";
  text: string;
}

interface State {
  error?: string;
  reply?: { text: string; fromAccount: boolean };
}

const initialState: State = {};

export function ChatPanel({
  locale,
  suggested,
  initialMessages,
}: {
  locale: Locale;
  suggested: string[];
  initialMessages: Message[];
}) {
  const [state, formAction, pending] = useActionState(askAssistant, initialState);
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);

  // Scroll to the newest exchange whenever one is added.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [initialMessages.length, state.reply]);

  // After a successful reply, refresh so the persisted history renders.
  useEffect(() => {
    if (state.reply) router.refresh();
  }, [state.reply, router]);

  return (
    <div className="flex flex-col gap-4">
      {initialMessages.length > 0 ? (
        <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto">
          {initialMessages.map((message) => (
            <li
              key={message.id}
              className={
                message.role === "USER"
                  ? "self-end rounded-2xl rounded-br-sm bg-leaf-700 px-3 py-2 text-sm text-white max-w-[85%]"
                  : "self-start rounded-card border border-rule bg-surface-sunken px-3 py-2 text-sm max-w-[85%]"
              }
            >
              <p className="whitespace-pre-wrap text-pretty">{message.text}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={endRef} aria-hidden="true" />

      {suggested.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {suggested.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => {
                const form = document.getElementById("assistant-form") as HTMLFormElement;
                const input = form.elements.namedItem("message") as HTMLTextAreaElement;
                if (input) {
                  input.value = question;
                  input.focus();
                }
              }}
              className="pill pill-neutral cursor-pointer"
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}

      <form id="assistant-form" action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="locale" value={locale} />

        <Field label="Ask a question" htmlFor="assistant-input">
          <textarea
            id="assistant-input"
            name="message"
            rows={2}
            maxLength={500}
            placeholder="What is my balance?"
            className="input resize-none"
            required
          />
        </Field>

        {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state?.reply ? (
          <Alert tone="success">
            <p className="whitespace-pre-wrap text-pretty">{state.reply.text}</p>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            Ask
          </Button>

          {initialMessages.length > 0 ? (
            <form action={clearConversation}>
              <Button type="submit" variant="ghost">
                Start a new conversation
              </Button>
            </form>
          ) : null}
        </div>
      </form>
    </div>
  );
}
