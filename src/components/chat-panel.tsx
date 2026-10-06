"use client";

import { useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import { ChatIcon, SendIcon } from "@/components/icons";

/**
 * Text assistant.
 *
 * Shares the `/api/voice` intent resolver with the voice screen: the same rule
 * set answers both, so the two features cannot drift into giving different
 * answers to the same question.
 */

interface Turn {
  id: number;
  question: string;
  answer: string;
  understood: boolean;
}

const QUICK = ["How to save faster", "What is a micro-loan", "How to avoid fraud"];

export function ChatPanel() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const nextId = useRef(1);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setDraft("");
    const id = nextId.current++;

    // Show the question immediately; the answer arrives when it does.
    setTurns((prev) => [...prev, { id, question: text, answer: "", understood: false }]);

    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spoken: text }),
      });
      const payload = await response.json();
      setTurns((prev) =>
        prev.map((turn) =>
          turn.id === id
            ? {
                ...turn,
                answer:
                  payload?.data?.reply ??
                  payload?.error?.message ??
                  "We could not reach the assistant just now.",
                understood: Boolean(payload?.data?.understood),
              }
            : turn
        )
      );
    } catch {
      setTurns((prev) =>
        prev.map((turn) =>
          turn.id === id
            ? { ...turn, answer: "We could not reach the server. Try again in a moment." }
            : turn
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[560px] flex-col">
      <div className="flex-1 overflow-y-auto p-5" aria-live="polite">
        {turns.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
              <ChatIcon size={22} />
            </span>
            <p className="text-[15px] font-semibold">Ask FinLeaf</p>
            <p className="max-w-sm text-[13px] text-muted">
              Plain-language answers about saving, borrowing, and avoiding fraud. Nothing you ask is
              sent to a third party.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {turns.map((turn) => (
              <div key={turn.id} className="flex flex-col gap-2">
                <div className="ml-auto max-w-[80%] rounded-lg bg-sunken px-3.5 py-2.5">
                  <p className="text-[14.5px]">{turn.question}</p>
                </div>
                <div className="max-w-[90%] rounded-lg bg-primary-soft px-3.5 py-2.5">
                  <p className="text-[14.5px] text-primary">
                    {turn.answer || (busy ? "Thinking…" : "")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => ask(q)}
              disabled={busy}
              className="rounded-full border border-border-strong px-3.5 py-1.5 text-[13px] font-medium hover:bg-sunken disabled:opacity-45"
            >
              {q}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            ask(draft);
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question"
            aria-label="Ask a question"
          />
          <Button type="submit" disabled={busy || !draft.trim()} aria-label="Send question">
            <SendIcon size={18} />
          </Button>
        </form>

        <p className="mt-3 text-[12.5px] text-muted">
          Answers are general guidance, not financial advice.
        </p>
      </div>
    </div>
  );
}