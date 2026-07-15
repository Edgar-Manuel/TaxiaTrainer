"use client";

/** Thin wrappers over the Web Speech API (es-ES), with graceful fallbacks. */

type RecognitionCtor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

export function createRecognizer(
  onResult: (transcript: string) => void,
  onEnd: () => void,
): SpeechRecognitionLike | null {
  if (!speechRecognitionSupported()) return null;
  const w = window as unknown as Record<string, unknown>;
  const Ctor = (w.SpeechRecognition ?? w.webkitSpeechRecognition) as RecognitionCtor;
  const recognizer = new Ctor();
  recognizer.lang = "es-ES";
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;
  recognizer.onresult = (event) => onResult(event.results[0][0].transcript);
  recognizer.onend = onEnd;
  recognizer.onerror = onEnd;
  return recognizer;
}

export function speak(text: string, enabled: boolean): void {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ""));
  utterance.lang = "es-ES";
  utterance.rate = 1.05;
  const spanish = window.speechSynthesis
    .getVoices()
    .find((v) => v.lang.startsWith("es"));
  if (spanish) utterance.voice = spanish;
  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
