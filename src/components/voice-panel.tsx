"use client";

import { useState } from "react";
import { useVoice } from "./use-voice";
import { Button, Input, Notice } from "@/components/ui";
import { MicIcon } from "@/components/icons";
import { Asset } from "@/components/illustration";

/**
 * Voice panel.
 *
 * The typed fallback is always present, not shown only on failure: someone
 * speaking in a library, or in a queue, should not have to grant microphone
 * access just to read a balance.
 */

const SUGGESTIONS = ["Check balance", "My trust score", "My carbon total"];

const STATE_MESSAGES: Record<string, string> = {
  unsupported:
    "This browser does not support speech recognition. Firefox and Safari both have limits. You can type your question below instead.",
  denied:
    "Microphone access was refused. To allow it, open your browser's site settings for this page, set the microphone to allow, then try again. Typing below works either way.",
  "no-speech": "We did not hear anything. Try again a little closer to the microphone.",
  error: "Something went wrong starting the microphone. Typing below still works.",
};

export function VoicePanel() {
  const voice = useVoice();
  const [typed, setTyped] = useState("");

  const busy = voice.busy;

  return (
    <div className="p-5">
      <div className="flex flex-col items-center gap-2 text-center">
        {/* Explains the feature in one glance for a user who has not used voice
            input before, which is most of the intended audience. */}
        <div className="mb-1 w-[190px]">
          <Asset
            name="voice-assistant"
            width={400}
            height={312}
            sizes="190px"
            className="h-auto w-full"
          />
        </div>
        <button
          type="button"
          onClick={voice.state === "listening" ? voice.stop : voice.start}
          disabled={busy || (!voice.supported && voice.state === "unsupported")}
          aria-pressed={voice.state === "listening"}
          aria-label={voice.state === "listening" ? "Stop listening" : "Start voice input"}
          className={`flex h-24 w-24 items-center justify-center rounded-full transition-colors ${
            voice.state === "listening"
              ? "bg-primary text-white"
              : voice.supported
                ? "bg-primary-soft text-primary hover:bg-primary-soft/70"
                : "cursor-not-allowed bg-sunken text-muted"
          }`}
        >
          <MicIcon size={36} />
        </button>

        <p className="mt-2 text-[17px] font-semibold">
          {voice.state === "listening" ? "Listening…" : "Tap to speak"}
        </p>
        <p className="text-[13px] text-muted">
          {voice.supported
            ? "Works in English, Hindi, and Kannada"
            : "Speech is not available in this browser"}
        </p>

        {voice.transcript && (
          <p className="mt-1 text-[14px] italic text-muted" aria-live="polite">
            &ldquo;{voice.transcript}&rdquo;
          </p>
        )}
      </div>

      {STATE_MESSAGES[voice.state] && (
        <div role="status" className="mt-4">
          <Notice tone="amber">{STATE_MESSAGES[voice.state]}</Notice>
        </div>
      )}

      {/* Transcript */}
      <div className="mt-5 rounded-md bg-sunken p-4">
        <h2 className="text-[13px] font-medium text-muted">What you asked</h2>
        {voice.answers.length === 0 ? (
          <p className="mt-2 text-[14px] text-muted">
            Nothing yet. Try one of the suggestions below.
          </p>
        ) : (
          <dl className="mt-2 flex flex-col gap-3">
            {voice.answers.map((a, i) => (
              <div key={i}>
                <dt className="text-[14px] font-semibold">&ldquo;{a.spoken}&rdquo;</dt>
                <dd className="text-[14px] text-muted">{a.reply}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => voice.submit(s)}
            disabled={busy}
            className="rounded-full border border-border-strong px-3.5 py-1.5 text-[13px] font-medium hover:bg-sunken disabled:opacity-45"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Always-available typed fallback. */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (typed.trim()) {
            voice.submit(typed);
            setTyped("");
          }
        }}
      >
        <Input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type your question"
          aria-label="Type your question"
        />
        <Button type="submit" disabled={busy || !typed.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}