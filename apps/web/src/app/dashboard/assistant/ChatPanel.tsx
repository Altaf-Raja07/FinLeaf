"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff } from "lucide-react";
import { Alert, Button, Field } from "@/components/ui";
import { SpeakButton } from "@/components/SpeakButton";
import { useVoiceInput } from "@/components/useVoiceInput";
import { askAssistant, clearConversation } from "./assistant-actions";
import { translate, type Locale } from "@/lib/i18n";

/**
 * Chat panel.
 *
 * Supports typed and spoken questions in English, Hindi, and Kannada.
 * The answer appears immediately from the action's returned state, and the
 * persisted history re-renders on the next request — which is why the panel
 * shows the reply without needing the page to reload, and why a refresh shows
 * the same conversation.
 *
 * Auto-scroll keeps the newest message in view.
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
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState("");

  const t = (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);

  const {
    supported: voiceSupported,
    listening,
    error: voiceError,
    start: startVoice,
    stop: stopVoice,
  } = useVoiceInput(locale, (transcript) => {
    setQuery(transcript);
    if (inputRef.current) {
      inputRef.current.value = transcript;
      inputRef.current.focus();
    }
  });

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
                  : "self-start flex flex-col gap-2 rounded-card border border-rule bg-surface-sunken px-3 py-2 text-sm max-w-[85%]"
              }
            >
              <p className="whitespace-pre-wrap text-pretty">{message.text}</p>
              {message.role === "ASSISTANT" ? (
                <div className="pt-1">
                  <SpeakButton locale={locale} text={message.text} variant="secondary" />
                </div>
              ) : null}
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
                setQuery(question);
                if (inputRef.current) {
                  inputRef.current.value = question;
                  inputRef.current.focus();
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

        <Field label={t("assistant.askLabel")} htmlFor="assistant-input">
          <div className="relative">
            <textarea
              ref={inputRef}
              id="assistant-input"
              name="message"
              rows={2}
              maxLength={500}
              placeholder={t("assistant.placeholder")}
              className="input resize-none pr-12"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
            />
            {voiceSupported ? (
              <button
                type="button"
                onClick={listening ? stopVoice : startVoice}
                aria-label={listening ? t("voice.stop") : t("voice.askByVoice")}
                title={listening ? t("voice.stop") : t("voice.askByVoice")}
                className={`absolute right-2.5 top-2.5 rounded-full p-2 transition-colors ${
                  listening
                    ? "bg-red-500 text-white animate-pulse"
                    : "text-ink-soft hover:bg-surface-sunken hover:text-ink"
                }`}
              >
                {listening ? (
                  <MicOff className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Mic className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
        </Field>

        {listening ? (
          <p className="text-sm font-semibold text-leaf-700 animate-pulse">
            {t("voice.listening")}
          </p>
        ) : null}

        {voiceError ? <Alert tone="warning">{voiceError}</Alert> : null}
        {state?.error ? <Alert tone="danger">{state.error}</Alert> : null}
        {state?.reply ? (
          <Alert tone="success" className="flex flex-col gap-2">
            <p className="whitespace-pre-wrap text-pretty">{state.reply.text}</p>
            <SpeakButton locale={locale} text={state.reply.text} />
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={pending}>
            {pending ? t("assistant.thinking") : t("assistant.send")}
          </Button>

          {initialMessages.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                await clearConversation();
                router.refresh();
              }}
            >
              {t("assistant.clear")}
            </Button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
