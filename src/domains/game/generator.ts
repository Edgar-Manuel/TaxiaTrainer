import type { CityData } from "@/domains/cities/types";
import { pickRandom, shuffle } from "@/lib/utils";
import { PLACE_CATEGORY_LABELS, type Street } from "@/types/database";
import type { Question, QuestionType } from "@/types/game";
import {
  areParallel,
  buildRouteGraph,
  centroidDistanceM,
  flowsInto,
  shortestRoute,
  type RouteGraph,
} from "./geo";

export interface GeneratorContext {
  city: CityData;
  /** Target ids the SRS wants to review first (due or weak). */
  preferredTargets?: Set<string>;
  difficulty?: 1 | 2 | 3;
}

let questionCounter = 0;
function qid(): string {
  return `q-${Date.now()}-${questionCounter++}`;
}

/** Picks a street, favouring SRS-preferred targets 70% of the time. */
function pickStreet(ctx: GeneratorContext, filter?: (s: Street) => boolean): Street | null {
  const pool = filter ? ctx.city.streets.filter(filter) : ctx.city.streets;
  if (pool.length === 0) return null;
  const preferred = ctx.preferredTargets
    ? pool.filter((s) => ctx.preferredTargets!.has(s.id))
    : [];
  const usePreferred = preferred.length > 0 && Math.random() < 0.7;
  const candidates = usePreferred ? preferred : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function streetOptions(city: CityData, correct: Street, distractors: Street[]) {
  const options = shuffle([correct, ...distractors]).map((s) => ({
    id: s.id,
    label: s.name,
  }));
  return { options, correctOptionId: correct.id };
}

// ---------------------------------------------------------------------------
// Per-mode generators
// ---------------------------------------------------------------------------

function findStreet(ctx: GeneratorContext): Question | null {
  const street = pickStreet(ctx);
  if (!street) return null;
  return {
    id: qid(),
    type: "find_street",
    prompt: `Marca la ${street.name}`,
    targetType: "street",
    targetIds: [street.id],
    answerGeometry: street.geojson,
    difficulty: ctx.difficulty ?? 1,
  };
}

function nameStreet(ctx: GeneratorContext): Question | null {
  const street = pickStreet(ctx);
  if (!street) return null;
  const distractors = pickRandom(
    ctx.city.streets
      .filter((s) => s.id !== street.id)
      .sort((a, b) => centroidDistanceM(street, a) - centroidDistanceM(street, b))
      .slice(0, 12),
    3,
  );
  if (distractors.length < 3) return null;
  return {
    id: qid(),
    type: "name_street",
    prompt: "¿Qué calle está iluminada en el mapa?",
    targetType: "street",
    targetIds: [street.id],
    highlight: [street.geojson],
    ...streetOptions(ctx.city, street, distractors),
    difficulty: ctx.difficulty ?? 1,
  };
}

function guessNeighborhood(ctx: GeneratorContext): Question | null {
  const { neighborhoods } = ctx.city;
  if (neighborhoods.length < 2) return null;
  const target = neighborhoods[Math.floor(Math.random() * neighborhoods.length)];
  const distractors = pickRandom(
    neighborhoods.filter((n) => n.id !== target.id),
    Math.min(3, neighborhoods.length - 1),
  );
  return {
    id: qid(),
    type: "guess_neighborhood",
    prompt: "¿Qué barrio está resaltado?",
    targetType: "neighborhood",
    targetIds: [target.id],
    highlightArea: target.geojson,
    options: shuffle([target, ...distractors]).map((n) => ({ id: n.id, label: n.name })),
    correctOptionId: target.id,
    difficulty: ctx.difficulty ?? 1,
  };
}

function findPlace(ctx: GeneratorContext): Question | null {
  const { places } = ctx.city;
  if (places.length === 0) return null;
  const preferred = ctx.preferredTargets
    ? places.filter((p) => ctx.preferredTargets!.has(p.id))
    : [];
  const pool = preferred.length > 0 && Math.random() < 0.7 ? preferred : places;
  const place = pool[Math.floor(Math.random() * pool.length)];
  const category = PLACE_CATEGORY_LABELS[place.category].toLowerCase();
  return {
    id: qid(),
    type: "find_place",
    prompt: `Localiza: ${place.name}`,
    targetType: "place",
    targetIds: [place.id],
    answerGeometry: { type: "Point", coordinates: place.point },
    explanation: `${place.name} (categoría: ${category})`,
    difficulty: ctx.difficulty ?? 1,
  };
}

function crossingStreet(ctx: GeneratorContext): Question | null {
  const street = pickStreet(ctx, (s) =>
    (ctx.city.intersectionsByStreet.get(s.id)?.length ?? 0) > 0,
  );
  if (!street) return null;
  const crossings = (ctx.city.intersectionsByStreet.get(street.id) ?? [])
    .map((x) =>
      ctx.city.streetById.get(
        x.street_a_id === street.id ? x.street_b_id : x.street_a_id,
      ),
    )
    .filter((s): s is Street => Boolean(s));
  if (crossings.length === 0) return null;
  const correct = crossings[Math.floor(Math.random() * crossings.length)];
  const crossingIds = new Set(crossings.map((s) => s.id));
  const distractors = pickRandom(
    ctx.city.streets.filter((s) => s.id !== street.id && !crossingIds.has(s.id)),
    3,
  );
  if (distractors.length < 3) return null;
  return {
    id: qid(),
    type: "crossing_street",
    prompt: `¿Qué calle cruza con ${street.name}?`,
    targetType: "street",
    targetIds: [street.id, correct.id],
    highlight: [street.geojson],
    ...streetOptions(ctx.city, correct, distractors),
    difficulty: ctx.difficulty ?? 2,
  };
}

function nearbyStreet(ctx: GeneratorContext): Question | null {
  const street = pickStreet(ctx);
  if (!street) return null;
  const sorted = ctx.city.streets
    .filter((s) => s.id !== street.id)
    .sort((a, b) => centroidDistanceM(street, a) - centroidDistanceM(street, b));
  const correct = sorted[0];
  if (!correct || centroidDistanceM(street, correct) > 500) return null;
  const distractors = pickRandom(sorted.slice(Math.min(8, sorted.length - 3)), 3);
  if (distractors.length < 3) return null;
  return {
    id: qid(),
    type: "nearby_street",
    prompt: `¿Qué calle está junto a ${street.name}?`,
    targetType: "street",
    targetIds: [street.id, correct.id],
    highlight: [street.geojson],
    ...streetOptions(ctx.city, correct, distractors),
    difficulty: ctx.difficulty ?? 2,
  };
}

function parallelStreet(ctx: GeneratorContext): Question | null {
  for (let attempt = 0; attempt < 12; attempt++) {
    const street = pickStreet(ctx);
    if (!street) return null;
    const parallels = ctx.city.streets.filter((s) => areParallel(ctx.city, street, s));
    if (parallels.length === 0) continue;
    const correct = parallels[0];
    const parallelIds = new Set(parallels.map((s) => s.id));
    const distractors = pickRandom(
      ctx.city.streets.filter((s) => s.id !== street.id && !parallelIds.has(s.id)),
      3,
    );
    if (distractors.length < 3) continue;
    return {
      id: qid(),
      type: "parallel_street",
      prompt: `¿Qué calle discurre paralela a ${street.name}?`,
      targetType: "street",
      targetIds: [street.id, correct.id],
      highlight: [street.geojson],
      ...streetOptions(ctx.city, correct, distractors),
      difficulty: ctx.difficulty ?? 3,
    };
  }
  return null;
}

function flowsIntoQuestion(ctx: GeneratorContext): Question | null {
  for (let attempt = 0; attempt < 12; attempt++) {
    const street = pickStreet(ctx);
    if (!street) return null;
    const targets = ctx.city.streets.filter((s) => flowsInto(street, s));
    if (targets.length === 0) continue;
    const correct = targets[Math.floor(Math.random() * targets.length)];
    const targetIds = new Set(targets.map((s) => s.id));
    const distractors = pickRandom(
      ctx.city.streets.filter((s) => s.id !== street.id && !targetIds.has(s.id)),
      3,
    );
    if (distractors.length < 3) continue;
    return {
      id: qid(),
      type: "flows_into",
      prompt: `¿En qué calle desemboca ${street.name}?`,
      targetType: "street",
      targetIds: [street.id, correct.id],
      highlight: [street.geojson],
      ...streetOptions(ctx.city, correct, distractors),
      difficulty: ctx.difficulty ?? 3,
    };
  }
  return null;
}

function visualMemory(ctx: GeneratorContext): Question | null {
  const count = 2 + (ctx.difficulty ?? 1);
  const seed = pickStreet(ctx);
  if (!seed) return null;
  const group = ctx.city.streets
    .filter((s) => s.id !== seed.id)
    .sort((a, b) => centroidDistanceM(seed, a) - centroidDistanceM(seed, b))
    .slice(0, count - 1);
  const streets = [seed, ...group];
  if (streets.length < 2) return null;
  return {
    id: qid(),
    type: "visual_memory",
    prompt: `Memoriza estas ${streets.length} calles`,
    targetType: "street",
    targetIds: streets.map((s) => s.id),
    memoryStreets: streets.map((s) => ({
      id: s.id,
      name: s.name,
      geometry: s.geojson,
    })),
    difficulty: ctx.difficulty ?? 2,
  };
}

let graphCache: { cityId: string; graph: RouteGraph } | null = null;
function getGraph(city: CityData): RouteGraph {
  if (graphCache?.cityId !== city.city.id) {
    graphCache = { cityId: city.city.id, graph: buildRouteGraph(city) };
  }
  return graphCache.graph;
}

function completeRoute(ctx: GeneratorContext, withRestrictions = false): Question | null {
  const { places } = ctx.city;
  if (places.length < 2) return null;
  const graph = getGraph(ctx.city);

  for (let attempt = 0; attempt < 15; attempt++) {
    const [origin, destination] = pickRandom(places, 2);
    if (!origin || !destination) return null;
    const crowDistM =
      centroidDistanceM(
        { centroid: origin.point } as Street,
        { centroid: destination.point } as Street,
      );
    if (crowDistM < 500 || crowDistM > 4000) continue;

    const baseRoute = shortestRoute(graph, origin.point, destination.point);
    if (!baseRoute || baseRoute.points.length < 4) continue;

    let blocked: string[] = [];
    let route = baseRoute;
    if (withRestrictions && baseRoute.streetIds.length > 1) {
      // Try each street of the optimal route until one still allows a detour.
      for (const candidate of shuffle(baseRoute.streetIds)) {
        const rerouted = shortestRoute(
          graph,
          origin.point,
          destination.point,
          new Set([candidate]),
        );
        if (rerouted) {
          blocked = [candidate];
          route = rerouted;
          break;
        }
      }
      if (blocked.length === 0) continue;
    }

    return {
      id: qid(),
      type: withRestrictions ? "fastest_route" : "complete_route",
      prompt: withRestrictions
        ? `Ruta más rápida de ${origin.name} a ${destination.name} (hay calles cortadas)`
        : `Traza el recorrido de ${origin.name} a ${destination.name}`,
      targetType: "street",
      targetIds: route.streetIds,
      origin: { name: origin.name, point: origin.point },
      destination: { name: destination.name, point: destination.point },
      optimalRoute: route.points,
      blockedStreetIds: blocked,
      difficulty: withRestrictions ? 3 : (ctx.difficulty ?? 2),
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const GENERATORS: Partial<
  Record<QuestionType, (ctx: GeneratorContext) => Question | null>
> = {
  find_street: findStreet,
  name_street: nameStreet,
  guess_neighborhood: guessNeighborhood,
  find_place: findPlace,
  crossing_street: crossingStreet,
  nearby_street: nearbyStreet,
  parallel_street: parallelStreet,
  flows_into: flowsIntoQuestion,
  visual_memory: visualMemory,
  complete_route: (ctx) => completeRoute(ctx, false),
  fastest_route: (ctx) => completeRoute(ctx, true),
};

export function generateQuestion(
  type: QuestionType,
  ctx: GeneratorContext,
): Question | null {
  return GENERATORS[type]?.(ctx) ?? null;
}

export function generateSession(
  type: QuestionType,
  ctx: GeneratorContext,
  count = 8,
): Question[] {
  const questions: Question[] = [];
  const usedTargets = new Set<string>();
  let guard = count * 6;
  while (questions.length < count && guard-- > 0) {
    const q = generateQuestion(type, ctx);
    if (!q) continue;
    const key = q.targetIds.join("|");
    if (usedTargets.has(key)) continue;
    usedTargets.add(key);
    questions.push(q);
  }
  return questions;
}

const EXAM_MIX: QuestionType[] = [
  "find_street",
  "name_street",
  "crossing_street",
  "nearby_street",
  "parallel_street",
  "flows_into",
  "guess_neighborhood",
  "find_place",
  "visual_memory",
  "complete_route",
];

export function generateExam(ctx: GeneratorContext, count = 20): Question[] {
  const questions: Question[] = [];
  let guard = count * 8;
  while (questions.length < count && guard-- > 0) {
    const type = EXAM_MIX[questions.length % EXAM_MIX.length];
    const q = generateQuestion(type, { ...ctx, difficulty: ((questions.length % 3) + 1) as 1 | 2 | 3 });
    if (q) questions.push(q);
  }
  return shuffle(questions);
}
