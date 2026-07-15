"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  INITIAL_SRS,
  isDue,
  qualityFromResult,
  review,
  type SrsState,
} from "@/domains/srs/sm2";
import { levelForXp, XP } from "@/lib/config";
import { todayISO } from "@/lib/utils";
import type { TargetType } from "@/types/database";
import type { QuestionResult, SessionSummary } from "@/types/game";

export interface RecordedAnswer {
  cityId: string;
  questionType: string;
  targetType: TargetType;
  targetId: string;
  correct: boolean;
  score: number;
  maxScore: number;
  distanceM?: number;
  timeMs: number;
  location?: [number, number];
  at: string;
}

export interface RecordedSession {
  id: string;
  cityId: string;
  mode: string;
  startedAt: string;
  score: number;
  maxScore: number;
  xpEarned: number;
  durationS: number;
  isExam: boolean;
  accuracy: number;
}

interface DayStats {
  xp: number;
  timeS: number;
  answers: number;
  correct: number;
}

interface ProgressState {
  xp: number;
  streakCurrent: number;
  streakBest: number;
  lastActivityDate: string | null;
  dailyGoalXp: number;
  /** SRS state keyed by `${targetType}:${targetId}`. */
  mastery: Record<string, SrsState>;
  achievements: string[];
  sessions: RecordedSession[];
  answers: RecordedAnswer[];
  studyDays: Record<string, DayStats>;
  favorites: string[];

  recordAnswer: (cityId: string, result: QuestionResult) => void;
  completeSession: (cityId: string, summary: SessionSummary) => RecordedSession;
  unlockAchievement: (code: string, xpReward: number) => boolean;
  toggleFavorite: (key: string) => void;
  setDailyGoal: (xp: number) => void;
  srsFor: (targetType: TargetType, targetId: string) => SrsState | undefined;
  dueTargets: (targetType: TargetType) => string[];
  reset: () => void;
}

const MAX_STORED_ANSWERS = 2000;

function masteryKey(targetType: TargetType, targetId: string): string {
  return `${targetType}:${targetId}`;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => ({
      xp: 0,
      streakCurrent: 0,
      streakBest: 0,
      lastActivityDate: null,
      dailyGoalXp: 50,
      mastery: {},
      achievements: [],
      sessions: [],
      answers: [],
      studyDays: {},
      favorites: [],

      recordAnswer: (cityId, result) => {
        const { question, correct, score, maxScore, timeMs, distanceM, clickLocation } =
          result;
        const quality = qualityFromResult(correct, maxScore > 0 ? score / maxScore : 0);

        set((state) => {
          const mastery = { ...state.mastery };
          for (const targetId of question.targetIds) {
            const key = masteryKey(question.targetType, targetId);
            mastery[key] = review(mastery[key] ?? INITIAL_SRS, quality);
          }
          const answer: RecordedAnswer = {
            cityId,
            questionType: question.type,
            targetType: question.targetType,
            targetId: question.targetIds[0] ?? "",
            correct,
            score,
            maxScore,
            distanceM,
            timeMs,
            location: clickLocation,
            at: new Date().toISOString(),
          };
          return {
            mastery,
            answers: [...state.answers.slice(-MAX_STORED_ANSWERS + 1), answer],
          };
        });
      },

      completeSession: (cityId, summary) => {
        const today = todayISO();
        const state = get();

        let xpEarned = summary.results.reduce(
          (sum, r) => sum + (r.correct ? XP.perCorrect : 0),
          0,
        );
        if (summary.accuracy === 1 && summary.results.length > 0) {
          xpEarned += XP.perPerfect * summary.results.length;
        }
        xpEarned += XP.sessionBonus;

        const session: RecordedSession = {
          id: crypto.randomUUID(),
          cityId,
          mode: summary.mode,
          startedAt: new Date(Date.now() - summary.durationS * 1000).toISOString(),
          score: summary.score,
          maxScore: summary.maxScore,
          xpEarned,
          durationS: summary.durationS,
          isExam: summary.mode === "official_exam",
          accuracy: summary.accuracy,
        };

        const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
        const streakCurrent =
          state.lastActivityDate === today
            ? state.streakCurrent
            : state.lastActivityDate === yesterday
              ? state.streakCurrent + 1
              : 1;

        const day = state.studyDays[today] ?? { xp: 0, timeS: 0, answers: 0, correct: 0 };

        set({
          xp: state.xp + xpEarned,
          streakCurrent,
          streakBest: Math.max(state.streakBest, streakCurrent),
          lastActivityDate: today,
          sessions: [...state.sessions.slice(-499), session],
          studyDays: {
            ...state.studyDays,
            [today]: {
              xp: day.xp + xpEarned,
              timeS: day.timeS + summary.durationS,
              answers: day.answers + summary.results.length,
              correct: day.correct + summary.results.filter((r) => r.correct).length,
            },
          },
        });

        return session;
      },

      unlockAchievement: (code, xpReward) => {
        const state = get();
        if (state.achievements.includes(code)) return false;
        set({
          achievements: [...state.achievements, code],
          xp: state.xp + xpReward,
        });
        return true;
      },

      toggleFavorite: (key) =>
        set((state) => ({
          favorites: state.favorites.includes(key)
            ? state.favorites.filter((f) => f !== key)
            : [...state.favorites, key],
        })),

      setDailyGoal: (dailyGoalXp) => set({ dailyGoalXp }),

      srsFor: (targetType, targetId) =>
        get().mastery[masteryKey(targetType, targetId)],

      dueTargets: (targetType) => {
        const prefix = `${targetType}:`;
        return Object.entries(get().mastery)
          .filter(([key, srs]) => key.startsWith(prefix) && isDue(srs))
          .map(([key]) => key.slice(prefix.length));
      },

      reset: () =>
        set({
          xp: 0,
          streakCurrent: 0,
          streakBest: 0,
          lastActivityDate: null,
          mastery: {},
          achievements: [],
          sessions: [],
          answers: [],
          studyDays: {},
          favorites: [],
        }),
    }),
    { name: "taxitrainer-progress" },
  ),
);

export function useLevel(): { level: number; xp: number } {
  const xp = useProgress((s) => s.xp);
  return { level: levelForXp(xp), xp };
}
