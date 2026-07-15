"use client";

import { useMemo, useState } from "react";
import { CityMap, type MapHighlight, type MapMarker } from "@/components/map/CityMap";
import type { CityData } from "@/domains/cities/types";
import { scoreMapClick } from "@/domains/game/scoring";
import type { LngLat } from "@/types/geo";
import type { Question, QuestionResult } from "@/types/game";

interface Props {
  city: CityData;
  question: Question;
  questionStartedAt: number;
  feedback: QuestionResult | null;
  onAnswer: (result: QuestionResult) => void;
}

/** find_street / find_place: tap the map where the target is. */
export function MapClickQuestionView({
  city,
  question,
  questionStartedAt,
  feedback,
  onAnswer,
}: Props) {
  const [click, setClick] = useState<LngLat | null>(null);

  const targetStreet = useMemo(
    () =>
      question.targetType === "street"
        ? city.streetById.get(question.targetIds[0])
        : undefined,
    [city, question],
  );

  const highlights: MapHighlight[] = [];
  const markers: MapMarker[] = [];

  if (feedback) {
    if (question.answerGeometry?.type === "Point") {
      markers.push({
        id: "answer",
        point: question.answerGeometry.coordinates,
        label: question.prompt.replace("Localiza: ", ""),
        color: "#22c55e",
      });
    } else if (question.answerGeometry) {
      highlights.push({
        id: "answer",
        geometry: question.answerGeometry,
        color: feedback.correct ? "#22c55e" : "#ef4444",
        width: 6,
        animated: true,
      });
    }
  }
  if (click) {
    markers.push({
      id: "click",
      point: click,
      emoji: "👆",
      color: feedback ? (feedback.correct ? "#22c55e" : "#ef4444") : "#3b82f6",
    });
  }

  return (
    <CityMap
      center={city.city.center}
      bbox={city.city.bbox}
      styleId="no-labels"
      highlights={highlights}
      markers={markers}
      fitTo={feedback && question.answerGeometry ? [question.answerGeometry] : null}
      onMapClick={(lngLat) => {
        if (feedback) return;
        setClick(lngLat);
        onAnswer(
          scoreMapClick(question, lngLat, Date.now() - questionStartedAt, targetStreet),
        );
      }}
    />
  );
}
