import type { LngLat, PointGeometry, StreetGeometry } from "./geo";

export type QuestionType =
  | "find_street"
  | "name_street"
  | "complete_route"
  | "visual_memory"
  | "guess_neighborhood"
  | "find_place"
  | "crossing_street"
  | "nearby_street"
  | "parallel_street"
  | "flows_into"
  | "fastest_route"
  | "ai_examiner"
  | "official_exam";

export interface GameModeInfo {
  type: QuestionType;
  title: string;
  description: string;
  icon: string;
  color: string;
  minStreets: number;
}

export const GAME_MODES: GameModeInfo[] = [
  {
    type: "find_street",
    title: "Encuentra la calle",
    description: "Toca en el mapa la calle que se te pide",
    icon: "🎯",
    color: "from-green-500 to-emerald-600",
    minStreets: 1,
  },
  {
    type: "name_street",
    title: "¿Qué calle es?",
    description: "Identifica la calle iluminada en el mapa",
    icon: "💡",
    color: "from-blue-500 to-indigo-600",
    minStreets: 4,
  },
  {
    type: "complete_route",
    title: "Completa el recorrido",
    description: "Dibuja la ruta entre dos puntos de la ciudad",
    icon: "🛣️",
    color: "from-violet-500 to-purple-600",
    minStreets: 10,
  },
  {
    type: "visual_memory",
    title: "Memoria visual",
    description: "Memoriza un grupo de calles y reconstrúyelo",
    icon: "🧠",
    color: "from-pink-500 to-rose-600",
    minStreets: 3,
  },
  {
    type: "guess_neighborhood",
    title: "Barrios",
    description: "Reconoce el barrio resaltado",
    icon: "🏘️",
    color: "from-amber-500 to-orange-600",
    minStreets: 0,
  },
  {
    type: "find_place",
    title: "Lugares importantes",
    description: "Localiza hospitales, hoteles, estaciones...",
    icon: "📍",
    color: "from-red-500 to-rose-600",
    minStreets: 0,
  },
  {
    type: "crossing_street",
    title: "Cruces",
    description: "¿Qué calle cruza con...?",
    icon: "✖️",
    color: "from-cyan-500 to-sky-600",
    minStreets: 8,
  },
  {
    type: "nearby_street",
    title: "Calles cercanas",
    description: "¿Qué calle está junto a...?",
    icon: "🧭",
    color: "from-teal-500 to-emerald-600",
    minStreets: 8,
  },
  {
    type: "parallel_street",
    title: "Calles paralelas",
    description: "¿Qué calle discurre paralela a...?",
    icon: "〰️",
    color: "from-lime-500 to-green-600",
    minStreets: 8,
  },
  {
    type: "flows_into",
    title: "Desembocaduras",
    description: "¿En qué calle desemboca...?",
    icon: "🔀",
    color: "from-fuchsia-500 to-pink-600",
    minStreets: 8,
  },
  {
    type: "fastest_route",
    title: "Ruta más rápida",
    description: "Rutas con calles cortadas y restricciones",
    icon: "⚡",
    color: "from-yellow-500 to-amber-600",
    minStreets: 10,
  },
  {
    type: "ai_examiner",
    title: "IA examinadora",
    description: "Conversación por voz con tu examinador personal",
    icon: "🎙️",
    color: "from-indigo-500 to-blue-700",
    minStreets: 10,
  },
  {
    type: "official_exam",
    title: "Examen oficial",
    description: "Simulacro cronometrado con informe final",
    icon: "📝",
    color: "from-slate-600 to-slate-800",
    minStreets: 10,
  },
];

export interface ChoiceOption {
  id: string;
  label: string;
}

/** A fully self-contained question the game engine can render and score. */
export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  /** Target ids for SRS bookkeeping. */
  targetType: "street" | "place" | "neighborhood";
  targetIds: string[];
  /** Multiple-choice options, when applicable. */
  options?: ChoiceOption[];
  correctOptionId?: string;
  /** Geometry to highlight before answering (name_street, memory...). */
  highlight?: StreetGeometry[];
  highlightArea?: GeoJSON.Geometry;
  /** For map-click questions: geometry of the correct answer. */
  answerGeometry?: StreetGeometry | PointGeometry;
  /** For route questions. */
  origin?: { name: string; point: LngLat };
  destination?: { name: string; point: LngLat };
  optimalRoute?: LngLat[];
  blockedStreetIds?: string[];
  /** Memory mode: streets to memorize. */
  memoryStreets?: { id: string; name: string; geometry: StreetGeometry }[];
  difficulty: 1 | 2 | 3;
  explanation?: string;
}

export interface QuestionResult {
  question: Question;
  correct: boolean;
  score: number;
  maxScore: number;
  distanceM?: number;
  timeMs: number;
  givenAnswer: unknown;
  clickLocation?: LngLat;
}

export interface SessionSummary {
  mode: QuestionType;
  results: QuestionResult[];
  score: number;
  maxScore: number;
  xpEarned: number;
  durationS: number;
  accuracy: number;
}
