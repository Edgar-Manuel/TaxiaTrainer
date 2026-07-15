/**
 * SM-2 spaced repetition (Anki-style), adapted to map training:
 * each answer produces a quality 0-5 which drives ease, interval and mastery.
 */

export interface SrsState {
  repetitions: number;
  ease: number;
  intervalDays: number;
  dueAt: string;
  mastery: number;
  lapses: number;
  lastCorrect: boolean | null;
}

export const INITIAL_SRS: SrsState = {
  repetitions: 0,
  ease: 2.5,
  intervalDays: 0,
  dueAt: new Date(0).toISOString(),
  mastery: 0,
  lapses: 0,
  lastCorrect: null,
};

/** Maps an answer to SM-2 quality: correctness + how good the score was. */
export function qualityFromResult(correct: boolean, scoreRatio: number): number {
  if (!correct) return scoreRatio > 0.3 ? 2 : 0;
  if (scoreRatio >= 0.95) return 5;
  if (scoreRatio >= 0.75) return 4;
  return 3;
}

export function review(state: SrsState, quality: number, now = new Date()): SrsState {
  const correct = quality >= 3;
  let { repetitions, ease, intervalDays, mastery, lapses } = state;

  ease = Math.max(1.3, ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));

  if (correct) {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.round(intervalDays * ease);
    mastery = Math.min(100, mastery + Math.round(8 + quality * 3));
  } else {
    repetitions = 0;
    intervalDays = 0;
    lapses += 1;
    mastery = Math.max(0, mastery - 25);
  }

  const dueAt = new Date(
    now.getTime() +
      (correct ? intervalDays * 86_400_000 : 10 * 60_000), // failed items come back in 10 min
  ).toISOString();

  return { repetitions, ease, intervalDays, dueAt, mastery, lapses, lastCorrect: correct };
}

export type MasteryBand = "unseen" | "weak" | "learning" | "mastered";

/** Traffic-light band used to colour the map: red / yellow / green. */
export function masteryBand(state: SrsState | undefined): MasteryBand {
  if (!state || (state.repetitions === 0 && state.lapses === 0)) return "unseen";
  if (state.mastery < 40) return "weak";
  if (state.mastery < 75) return "learning";
  return "mastered";
}

export const MASTERY_COLORS: Record<MasteryBand, string> = {
  unseen: "#94a3b8",
  weak: "#ef4444",
  learning: "#eab308",
  mastered: "#22c55e",
};

export function isDue(state: SrsState | undefined, now = new Date()): boolean {
  if (!state) return true;
  return new Date(state.dueAt).getTime() <= now.getTime();
}
