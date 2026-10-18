"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { translate, type Locale } from "@/lib/i18n";

/**
 * Voice input over the browser's own SpeechRecognition.
 *
 * Deliberately not an SDK. Chrome and Safari both ship recognition, the audio
 * never leaves the device, and every other browser simply gets no microphone
 * button rather than a broken one. If the device's recognition service is
 * unavailable, `onerror` fires and the field behaves exactly as it does with
 * the microphone off — typing is always the fallback.
 *
 * The Web Speech API is not in TypeScript's DOM library, so the surface this
 * module actually uses is described locally. That is a maintenance cost
 * accepted in exchange for not depending on every browser's own prefix
 * behaviour leaking into the rest of the app.
 */

/** Indian voices are the ones that exist for these languages. */
const RECOGNITION_TAGS: Record<Locale, string> = {
  en: "en-IN",
  hi: "hi-IN",
  kn: "kn-IN",
};

interface RecognitionEvent {
  resultIndex: number;
  results: {
    readonly length: number;
    [index: number]: { readonly 0: { transcript: string }; isFinal: boolean };
  };
}

interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const emptySubscribe = () => () => {};

/**
 * Listens once, then hands the final transcript back.
 *
 * `supported` uses `useSyncExternalStore` so the server render and the first
 * client render agree safely; a browser without recognition never sees the control.
 */
export function useVoiceInput(locale: Locale, onTranscript: (text: string) => void) {
  const supported = useSyncExternalStore(
    emptySubscribe,
    () => recognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<RecognitionLike | null>(null);

  const stop = useCallback(() => {
    try {
      recognition.current?.stop();
    } catch {
      // Ignore
    }
    setListening(false);
  }, []);

  // The microphone must not stay open if the component goes away.
  useEffect(() => () => {
    try {
      recognition.current?.abort();
    } catch {
      // Ignore
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      setError(translate(locale, "voice.notSupported"));
      return;
    }

    try {
      const instance = new Ctor();
      recognition.current = instance;
      instance.lang = RECOGNITION_TAGS[locale] ?? "en-IN";
      // One utterance at a time: the question is a single phrase, and leaving
      // recognition running would let it transcribe a whole room.
      instance.continuous = false;
      instance.interimResults = false;
      instance.maxAlternatives = 1;

      instance.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          if (event.results[i].isFinal) {
            onTranscript(event.results[i][0].transcript.trim());
          }
        }
      };

      instance.onerror = (event) => {
        setError(
          translate(locale, event.error === "no-speech" ? "voice.noSpeech" : "voice.error"),
        );
      };

      instance.onend = () => setListening(false);

      setError(null);
      setListening(true);
      instance.start();
    } catch {
      setError(translate(locale, "voice.error"));
      setListening(false);
    }
  }, [locale, onTranscript]);

  return { supported, listening, error, start, stop };
}
