"use client";

import { CheckIcon, RotateCcwIcon, Undo2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { CityMap, type MapHighlight, type MapMarker } from "@/components/map/CityMap";
import type { CityData } from "@/domains/cities/types";
import { scoreRoute } from "@/domains/game/scoring";
import type { LngLat } from "@/types/geo";
import type { Question, QuestionResult } from "@/types/game";

interface Props {
  city: CityData;
  question: Question;
  questionStartedAt: number;
  feedback: QuestionResult | null;
  onAnswer: (result: QuestionResult) => void;
}

/** complete_route / fastest_route: tap waypoints to draw the itinerary. */
export function RouteQuestionView({
  city,
  question,
  questionStartedAt,
  feedback,
  onAnswer,
}: Props) {
  const [points, setPoints] = useState<LngLat[]>(
    question.origin ? [question.origin.point] : [],
  );

  const highlights = useMemo(() => {
    const list: MapHighlight[] = [];
    for (const blockedId of question.blockedStreetIds ?? []) {
      const street = city.streetById.get(blockedId);
      if (street) {
        list.push({
          id: `blocked-${blockedId}`,
          geometry: street.geojson,
          color: "#ef4444",
          width: 5,
          dashed: true,
        });
      }
    }
    if (points.length >= 2) {
      list.push({
        id: "drawn",
        geometry: { type: "LineString", coordinates: points },
        color: "#3b82f6",
        width: 5,
        arrows: true,
      });
    }
    if (feedback && question.optimalRoute) {
      list.push({
        id: "optimal",
        geometry: { type: "LineString", coordinates: question.optimalRoute },
        color: "#22c55e",
        width: 6,
        opacity: 0.85,
        arrows: true,
        animated: true,
      });
    }
    return list;
  }, [points, feedback, question, city]);

  const markers = useMemo(() => {
    const list: MapMarker[] = [];
    if (question.origin) {
      list.push({ id: "origin", point: question.origin.point, emoji: "🚕", label: question.origin.name, color: "#3b82f6" });
    }
    if (question.destination) {
      list.push({ id: "dest", point: question.destination.point, emoji: "🏁", label: question.destination.name, color: "#22c55e" });
    }
    return list;
  }, [question]);

  const fitTo = useMemo(() => {
    if (!question.origin || !question.destination) return null;
    return [
      {
        type: "LineString",
        coordinates: [question.origin.point, question.destination.point],
      } as GeoJSON.Geometry,
    ];
  }, [question]);

  return (
    <div className="relative h-full">
      <CityMap
        center={city.city.center}
        bbox={city.city.bbox}
        highlights={highlights}
        markers={markers}
        fitTo={fitTo}
        fitPadding={90}
        onMapClick={(lngLat) => {
          if (feedback) return;
          setPoints((prev) => [...prev, lngLat]);
        }}
      />
      {!feedback && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border-2 bg-card/95 p-2 shadow-xl backdrop-blur">
          <Button
            variant="outline"
            size="sm"
            disabled={points.length <= 1}
            onClick={() => setPoints((prev) => prev.slice(0, -1))}
          >
            <Undo2Icon /> Deshacer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={points.length <= 1}
            onClick={() => setPoints(question.origin ? [question.origin.point] : [])}
          >
            <RotateCcwIcon /> Borrar
          </Button>
          <Button
            size="sm"
            disabled={points.length < 3}
            onClick={() => {
              const complete = question.destination
                ? [...points, question.destination.point]
                : points;
              onAnswer(scoreRoute(question, complete, Date.now() - questionStartedAt));
            }}
          >
            <CheckIcon /> Confirmar ruta
          </Button>
        </div>
      )}
    </div>
  );
}
