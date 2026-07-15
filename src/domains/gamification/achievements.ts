"use client";

import confetti from "canvas-confetti";
import { sounds } from "@/lib/sound";
import { masteryBand } from "@/domains/srs/sm2";
import { useProgress } from "@/stores/progress-store";
import { useToasts } from "@/stores/toast-store";
import type { SessionSummary } from "@/types/game";

export interface AchievementDef {
  code: string;
  name: string;
  description: string;
  icon: string;
  xpReward: number;
}

/** Client-side mirror of the achievements catalog (seeded in Supabase too). */
export const ACHIEVEMENTS: AchievementDef[] = [
  { code: "first_session", name: "Primera carrera", description: "Completa tu primera sesión", icon: "🚕", xpReward: 20 },
  { code: "streak_3", name: "Constancia", description: "Racha de 3 días", icon: "🔥", xpReward: 30 },
  { code: "streak_7", name: "Semana perfecta", description: "Racha de 7 días", icon: "🔥", xpReward: 70 },
  { code: "streak_30", name: "Imparable", description: "Racha de 30 días", icon: "🌋", xpReward: 300 },
  { code: "streets_10", name: "Novato del callejero", description: "Domina 10 calles", icon: "🗺️", xpReward: 25 },
  { code: "streets_50", name: "Conocedor", description: "Domina 50 calles", icon: "🗺️", xpReward: 100 },
  { code: "streets_200", name: "Callejero humano", description: "Domina 200 calles", icon: "🧠", xpReward: 400 },
  { code: "perfect_session", name: "Sesión perfecta", description: "Una sesión sin fallos", icon: "💯", xpReward: 50 },
  { code: "exam_pass", name: "Apto", description: "Aprueba un examen simulado", icon: "📝", xpReward: 150 },
  { code: "exam_ace", name: "Matrícula de honor", description: "Más del 90% en un examen", icon: "🎓", xpReward: 250 },
  { code: "xp_1000", name: "Motor caliente", description: "Acumula 1.000 XP", icon: "⚡", xpReward: 50 },
  { code: "xp_10000", name: "Taxista veterano", description: "Acumula 10.000 XP", icon: "🏆", xpReward: 200 },
  { code: "night_owl", name: "Turno de noche", description: "Estudia después de las 23:00", icon: "🌙", xpReward: 25 },
  { code: "early_bird", name: "Primer turno", description: "Estudia antes de las 07:00", icon: "🌅", xpReward: 25 },
  { code: "places_25", name: "Guía turístico", description: "Domina 25 lugares", icon: "🏛️", xpReward: 100 },
];

interface CheckInput {
  progress: ReturnType<typeof useProgress.getState>;
  justFinished?: { summary: SessionSummary; isExam: boolean; passed: boolean };
}

/** Evaluates every achievement rule against current progress. */
export function checkAchievements({ progress, justFinished }: CheckInput): void {
  const masteredStreets = Object.entries(progress.mastery).filter(
    ([key, srs]) => key.startsWith("street:") && masteryBand(srs) === "mastered",
  ).length;
  const masteredPlaces = Object.entries(progress.mastery).filter(
    ([key, srs]) => key.startsWith("place:") && masteryBand(srs) === "mastered",
  ).length;
  const hour = new Date().getHours();
  const scoreRatio = justFinished
    ? justFinished.summary.maxScore > 0
      ? justFinished.summary.score / justFinished.summary.maxScore
      : 0
    : 0;

  const satisfied: Record<string, boolean> = {
    first_session: progress.sessions.length >= 1,
    streak_3: progress.streakCurrent >= 3,
    streak_7: progress.streakCurrent >= 7,
    streak_30: progress.streakCurrent >= 30,
    streets_10: masteredStreets >= 10,
    streets_50: masteredStreets >= 50,
    streets_200: masteredStreets >= 200,
    perfect_session:
      justFinished !== undefined &&
      justFinished.summary.accuracy === 1 &&
      justFinished.summary.results.length > 0,
    exam_pass: justFinished?.isExam === true && justFinished.passed,
    exam_ace: justFinished?.isExam === true && scoreRatio >= 0.9,
    xp_1000: progress.xp >= 1000,
    xp_10000: progress.xp >= 10000,
    night_owl: justFinished !== undefined && hour >= 23,
    early_bird: justFinished !== undefined && hour < 7,
    places_25: masteredPlaces >= 25,
  };

  for (const def of ACHIEVEMENTS) {
    if (!satisfied[def.code]) continue;
    const unlocked = useProgress.getState().unlockAchievement(def.code, def.xpReward);
    if (unlocked) {
      sounds.achievement();
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.3 } });
      useToasts.getState().push({
        icon: def.icon,
        title: `¡Logro desbloqueado: ${def.name}!`,
        description: `${def.description} · +${def.xpReward} XP`,
      });
    }
  }
}
