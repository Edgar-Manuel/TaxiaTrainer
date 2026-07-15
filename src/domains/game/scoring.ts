import distance from "@turf/distance";
import type { Street } from "@/types/database";
import type { LngLat } from "@/types/geo";
import type { Question, QuestionResult } from "@/types/game";
import { distanceToStreet, routeCoverage } from "./geo";

/** Distance thresholds (meters) for map-click answers. */
const STREET_HIT_M = 60;
const STREET_ZERO_M = 400;
const PLACE_HIT_M = 120;
const PLACE_ZERO_M = 800;

export function scoreMapClick(
  question: Question,
  click: LngLat,
  timeMs: number,
  street?: Street,
): QuestionResult {
  let distanceM: number;
  if (question.answerGeometry?.type === "Point") {
    distanceM =
      distance(click, question.answerGeometry.coordinates, { units: "kilometers" }) *
      1000;
  } else if (street) {
    distanceM = distanceToStreet(click, street);
  } else {
    distanceM = Infinity;
  }

  const hit = question.type === "find_place" ? PLACE_HIT_M : STREET_HIT_M;
  const zero = question.type === "find_place" ? PLACE_ZERO_M : STREET_ZERO_M;
  const correct = distanceM <= hit;
  const score = correct ? 1 : Math.max(0, 1 - (distanceM - hit) / (zero - hit));

  return {
    question,
    correct,
    score: Math.round(score * 100) / 100,
    maxScore: 1,
    distanceM: Math.round(distanceM),
    timeMs,
    givenAnswer: click,
    clickLocation: click,
  };
}

export function scoreChoice(
  question: Question,
  optionId: string,
  timeMs: number,
): QuestionResult {
  const correct = optionId === question.correctOptionId;
  return {
    question,
    correct,
    score: correct ? 1 : 0,
    maxScore: 1,
    timeMs,
    givenAnswer: optionId,
  };
}

export function scoreRoute(
  question: Question,
  drawn: LngLat[],
  timeMs: number,
): QuestionResult {
  const coverage = routeCoverage(question.optimalRoute ?? [], drawn);
  const correct = coverage >= 0.7;
  return {
    question,
    correct,
    score: Math.round(coverage * 100) / 100,
    maxScore: 1,
    timeMs,
    givenAnswer: drawn,
    clickLocation: drawn[drawn.length - 1],
  };
}

export function scoreMemory(
  question: Question,
  foundIds: string[],
  missedClicks: number,
  timeMs: number,
): QuestionResult {
  const total = question.memoryStreets?.length ?? 1;
  const found = foundIds.length;
  const raw = Math.max(0, found - missedClicks * 0.5) / total;
  const correct = found === total && missedClicks === 0;
  return {
    question,
    correct,
    score: Math.round(raw * 100) / 100,
    maxScore: 1,
    timeMs,
    givenAnswer: { foundIds, missedClicks },
  };
}
