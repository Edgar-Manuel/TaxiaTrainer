"use client";

import { useSettings } from "@/stores/settings-store";

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  ctx ??= new AudioContext();
  return ctx;
}

function tone(freq: number, startS: number, durationS: number, gainValue = 0.12) {
  const audio = audioContext();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, audio.currentTime + startS);
  gain.gain.linearRampToValueAtTime(gainValue, audio.currentTime + startS + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + startS + durationS);
  osc.connect(gain).connect(audio.destination);
  osc.start(audio.currentTime + startS);
  osc.stop(audio.currentTime + startS + durationS + 0.05);
}

function enabled(): boolean {
  return useSettings.getState().sound;
}

/** Duolingo-style feedback sounds, synthesized (no audio assets). */
export const sounds = {
  correct() {
    if (!enabled()) return;
    tone(660, 0, 0.12);
    tone(880, 0.1, 0.2);
  },
  wrong() {
    if (!enabled()) return;
    tone(280, 0, 0.18, 0.1);
    tone(210, 0.15, 0.28, 0.1);
  },
  finish() {
    if (!enabled()) return;
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.25));
  },
  tick() {
    if (!enabled()) return;
    tone(1200, 0, 0.05, 0.05);
  },
  achievement() {
    if (!enabled()) return;
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.1, 0.3));
  },
};
