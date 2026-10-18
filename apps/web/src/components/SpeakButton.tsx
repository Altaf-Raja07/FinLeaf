"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { Button } from "./ui";
import { translate, type Locale } from "@/lib/i18n";

/**
 * Reads a piece of text out loud in the active language.
 *
 * Voice input and output both run on the browser's own speech APIs: there is
 * no SDK, nothing is sent to a third party, and a browser that lacks the API
 * simply never renders the button. That is what makes voice available to a
 * low-literacy user on an old phone without making it a dependency.
 */

const SPEECH_TAGS: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
};

/**
 * Picks the closest installed voice to the tag.
 *
 * Exact matches first, then any voice for the same language: a device with
 * "hi" but not "hi-IN" installed should still read Hindi rather than falling
 * back to an English voice reading Devanagari letter by letter.
 */
function pickVoice(tag: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const language = tag.slice(0, 2);
  return voices.find((v) => v.lang === tag) ?? voices.find((v) => v.lang.startsWith(language)) ?? null;
}

const emptySubscribe = () => () => {};

export function SpeakButton({
  locale,
  text,
  variant = "secondary",
}: {
  locale: Locale;
  text: string;
  variant?: "primary" | "secondary";
}) {
  const supported = useSyncExternalStore(
    emptySubscribe,
    () => typeof window !== "undefined" && "speechSynthesis" in window,
    () => false,
  );
  const [speaking, setSpeaking] = useState(false);

  // Leaving the page mid-sentence must not leave the phone talking.
  useEffect(() => {
    if (!supported) return;
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    };
  }, [supported]);

  if (!supported) return null;

  const t = (key: string) => translate(locale, key);

  function speak() {
    if (speaking) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
      setSpeaking(false);
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = SPEECH_TAGS[locale] ?? "en-IN";
      const voice = pickVoice(utterance.lang);
      if (voice) utterance.voice = voice;
      // Marginally slower than default: these instructions are read to people
      // who may be hearing the text for the first time.
      utterance.rate = 0.95;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      setSpeaking(true);
    } catch {
      setSpeaking(false);
    }
  }

  return (
    <Button type="button" variant={variant} onClick={speak} className="self-start">
      <Volume2 className="h-4 w-4" aria-hidden="true" />
      {speaking ? t("voice.stop") : t("voice.listen")}
    </Button>
  );
}
