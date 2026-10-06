"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice capture and command handling, via the browser Web Speech API.
 *
 * Every failure mode is handled rather than assumed away, because the target
 * audience is exactly the people most likely to hit one:
 *
 *  - `SpeechRecognition` missing (Firefox, most of Safari): fall back to typing,
 *    and say so rather than showing a dead microphone.
 *  - Permission denied: explain what to do about it in the browser's own settings.
 *  - No speech detected, or the user said nothing intelligible: say so and offer
 *    the keyboard.
 *
 * The transcript is sent to `/api/voice`, which resolves it against real account
 * data. No audio leaves the device: recognition is performed by the browser.
 */

export type VoiceState =
  | "idle"
  | "listening"
  | "unsupported"
  | "denied"
  | "no-speech"
  | "error";

interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

export interface VoiceAnswer {
  spoken: string;
  reply: string;
}

export function useVoice() {
  const [state, setState] = useState<VoiceState>("idle");
  const [transcript, setTranscript] = useState("");
  const [answers, setAnswers] = useState<VoiceAnswer[]>([]);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const answersRef = useRef<VoiceAnswer[]>([]);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  // Close any open recognition stream on unmount, so navigating away does not
  // leave the microphone hot.
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped; nothing to do.
      }
    };
  }, []);

  const submit = useCallback(async (text: string) => {
    const spoken = text.trim();
    if (!spoken || busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spoken }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setAnswers((prev) => [
          ...prev,
          { spoken, reply: payload?.error?.message ?? "We could not work that out just now." },
        ]);
        return;
      }
      setAnswers((prev) => {
        const next = [...prev, { spoken, reply: payload.data.reply }];
        answersRef.current = next;
        return next;
      });
    } catch {
      setAnswers((prev) => [
        ...prev,
        { spoken, reply: "We could not reach the server. Check your connection and try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const start = useCallback(() => {
    if (!supported) {
      setState("unsupported");
      return;
    }

    const Ctor =
      (window as unknown as { SpeechRecognition?: SpeechRecognitionCtor }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: SpeechRecognitionCtor }).webkitSpeechRecognition;

    if (!Ctor) {
      setState("unsupported");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      const combined = (finalText || interim).trim();
      setTranscript(combined);
      if (finalText.trim()) {
        setState("idle");
        void submit(finalText.trim());
        setTranscript("");
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorLike) => {
      switch (event.error) {
        case "not-allowed":
        case "service-not-allowed":
          setState("denied");
          break;
        case "no-speech":
          setState("no-speech");
          break;
        default:
          setState("error");
      }
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setState((current) => (current === "listening" ? "idle" : current));
    };

    recognitionRef.current = recognition;
    setState("listening");
    try {
      recognition.start();
    } catch {
      setState("error");
    }
  }, [supported, submit]);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // Already stopped.
    }
    setState("idle");
  }, []);

  return { state, transcript, answers, busy, supported, start, stop, submit, setAnswers };
}

/* Minimal structural types for the Web Speech API, which TypeScript's DOM lib
   does not declare everywhere. Declared locally rather than pulled from a
   definitions package for two methods. */
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionLike;
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
}
interface SpeechRecognitionErrorLike {
  error: string;
}