export const APP_NAME = "TaxiTrainer AI";
export const APP_DESCRIPTION =
  "Domina el callejero de tu ciudad y aprueba el examen de taxista con mapas interactivos, IA y repetición espaciada.";

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/**
 * Demo mode: when Supabase isn't configured the app runs fully client-side
 * with the bundled Santander dataset and progress persisted in localStorage.
 */
export const isDemoMode = !supabaseConfig.url || !supabaseConfig.anonKey;

export const mapConfig = {
  /** Optional MapTiler key enables premium vector styles + satellite. */
  maptilerKey: process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "",
};

export const XP = {
  perCorrect: 10,
  perPerfect: 5,
  sessionBonus: 15,
  examPassBonus: 100,
} as const;

export const EXAM = {
  questionCount: 20,
  timeLimitS: 15 * 60,
  passPct: 0.75,
} as const;

export function xpForLevel(level: number): number {
  return 100 * (level - 1) ** 2;
}

export function levelForXp(xp: number): number {
  return 1 + Math.floor(Math.sqrt(xp / 100));
}
