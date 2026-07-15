"use client";

import { create } from "zustand";
import type { Question, QuestionResult, QuestionType, SessionSummary } from "@/types/game";

export type GamePhase = "idle" | "playing" | "feedback" | "finished";

interface GameState {
  mode: QuestionType | null;
  cityId: string | null;
  questions: Question[];
  currentIndex: number;
  results: QuestionResult[];
  phase: GamePhase;
  startedAt: number;
  questionStartedAt: number;
  timeLimitS: number | null;

  start: (
    mode: QuestionType,
    cityId: string,
    questions: Question[],
    timeLimitS?: number,
  ) => void;
  submitResult: (result: QuestionResult) => void;
  next: () => void;
  finish: () => void;
  reset: () => void;
}

export const useGame = create<GameState>((set, get) => ({
  mode: null,
  cityId: null,
  questions: [],
  currentIndex: 0,
  results: [],
  phase: "idle",
  startedAt: 0,
  questionStartedAt: 0,
  timeLimitS: null,

  start: (mode, cityId, questions, timeLimitS) =>
    set({
      mode,
      cityId,
      questions,
      currentIndex: 0,
      results: [],
      phase: "playing",
      startedAt: Date.now(),
      questionStartedAt: Date.now(),
      timeLimitS: timeLimitS ?? null,
    }),

  submitResult: (result) =>
    set((state) => ({
      results: [...state.results, result],
      phase: "feedback",
    })),

  next: () => {
    const { currentIndex, questions } = get();
    if (currentIndex + 1 >= questions.length) {
      set({ phase: "finished" });
    } else {
      set({
        currentIndex: currentIndex + 1,
        phase: "playing",
        questionStartedAt: Date.now(),
      });
    }
  },

  finish: () => set({ phase: "finished" }),

  reset: () =>
    set({
      mode: null,
      cityId: null,
      questions: [],
      currentIndex: 0,
      results: [],
      phase: "idle",
      timeLimitS: null,
    }),
}));

export function buildSummary(state: {
  mode: QuestionType;
  results: QuestionResult[];
  startedAt: number;
}): SessionSummary {
  const { mode, results, startedAt } = state;
  const score = results.reduce((sum, r) => sum + r.score, 0);
  const maxScore = results.reduce((sum, r) => sum + r.maxScore, 0);
  const correctCount = results.filter((r) => r.correct).length;
  return {
    mode,
    results,
    score,
    maxScore,
    xpEarned: 0, // assigned by the progress store on completion
    durationS: Math.round((Date.now() - startedAt) / 1000),
    accuracy: results.length > 0 ? correctCount / results.length : 0,
  };
}
