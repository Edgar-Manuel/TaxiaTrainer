import type {
  AreaGeometry,
  LngLat,
  PointGeometry,
  StreetGeometry,
} from "./geo";

export type UserRole = "user" | "admin";
export type CityStatus = "draft" | "importing" | "ready";
export type TargetType = "street" | "place" | "neighborhood";

export type PlaceCategory =
  | "hospital"
  | "hotel"
  | "beach"
  | "official_building"
  | "station"
  | "university"
  | "monument"
  | "mall"
  | "police"
  | "fire_station"
  | "court"
  | "market"
  | "park"
  | "square"
  | "other";

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  hospital: "Hospitales",
  hotel: "Hoteles",
  beach: "Playas",
  official_building: "Edificios oficiales",
  station: "Estaciones",
  university: "Universidades",
  monument: "Monumentos",
  mall: "Centros comerciales",
  police: "Comisarías",
  fire_station: "Bomberos",
  court: "Juzgados",
  market: "Mercados",
  park: "Parques",
  square: "Plazas",
  other: "Otros",
};

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  role: UserRole;
  active_city_id: string | null;
  xp: number;
  level: number;
  streak_current: number;
  streak_best: number;
  last_activity_date: string | null;
  daily_goal_xp: number;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface City {
  id: string;
  slug: string;
  name: string;
  country: string;
  center: LngLat;
  bbox: [number, number, number, number] | null;
  osm_relation_id: number | null;
  status: CityStatus;
  streets_count: number;
  places_count: number;
  published: boolean;
  created_at: string;
}

export interface Neighborhood {
  id: string;
  city_id: string;
  name: string;
  osm_id: number | null;
  geojson: AreaGeometry;
  centroid: LngLat;
}

export interface Street {
  id: string;
  city_id: string;
  neighborhood_id: string | null;
  name: string;
  normalized_name: string;
  osm_way_ids: number[];
  highway_type: string;
  oneway: boolean;
  length_m: number;
  geojson: StreetGeometry;
  centroid: LngLat;
  aliases: string[];
}

export interface Intersection {
  id: string;
  city_id: string;
  street_a_id: string;
  street_b_id: string;
  point: LngLat;
}

export interface Place {
  id: string;
  city_id: string;
  neighborhood_id: string | null;
  category: PlaceCategory;
  name: string;
  osm_id: number | null;
  point: LngLat;
  address: string | null;
  tags: Record<string, string>;
}

export interface GameSessionRow {
  id: string;
  user_id: string;
  city_id: string;
  mode: string;
  started_at: string;
  finished_at: string | null;
  score: number;
  max_score: number;
  xp_earned: number;
  duration_s: number;
  is_exam: boolean;
  meta: Record<string, unknown>;
}

export interface AnswerRow {
  id: string;
  session_id: string;
  user_id: string;
  city_id: string;
  question_type: string;
  street_id: string | null;
  place_id: string | null;
  neighborhood_id: string | null;
  correct: boolean;
  score: number;
  expected: unknown;
  given: unknown;
  distance_m: number | null;
  time_ms: number;
  location: LngLat | null;
  created_at: string;
}

/** SM-2 spaced-repetition state for one learnable target. */
export interface MasteryRow {
  user_id: string;
  city_id: string;
  target_type: TargetType;
  target_id: string;
  repetitions: number;
  ease: number;
  interval_days: number;
  due_at: string;
  mastery: number;
  lapses: number;
  last_correct: boolean | null;
  updated_at: string;
}

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  criteria: { type: string; threshold: number };
}

export interface UserAchievement {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
}

export interface Favorite {
  user_id: string;
  city_id: string;
  target_type: TargetType;
  target_id: string;
  created_at: string;
}

export interface Collection {
  id: string;
  user_id: string;
  city_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface RouteRow {
  id: string;
  city_id: string;
  user_id: string | null;
  name: string;
  origin_place_id: string | null;
  destination_place_id: string | null;
  geojson: StreetGeometry;
  distance_m: number;
  meta: Record<string, unknown>;
}

export interface StudyDay {
  user_id: string;
  city_id: string;
  day: string;
  xp: number;
  time_s: number;
  answers_count: number;
  correct_count: number;
}
