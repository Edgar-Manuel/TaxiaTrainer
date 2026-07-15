"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";
import { CityMap, type MapHighlight } from "@/components/map/CityMap";
import { cn } from "@/lib/utils";
import type { CityData } from "@/domains/cities/types";
import { scoreChoice } from "@/domains/game/scoring";
import type { Question, QuestionResult } from "@/types/game";

interface Props {
  city: CityData;
  question: Question;
  questionStartedAt: number;
  feedback: QuestionResult | null;
  onAnswer: (result: QuestionResult) => void;
}

/** Multiple-choice modes: the map shows context, the user picks a name. */
export function ChoiceQuestionView({
  city,
  question,
  questionStartedAt,
  feedback,
  onAnswer,
}: Props) {
  const highlights = useMemo(() => {
    const list: MapHighlight[] = [];
    if (question.highlight) {
      question.highlight.forEach((g, i) =>
        list.push({
          id: `subject-${i}`,
          geometry: g,
          color: "#3b82f6",
          width: 6,
          animated: !feedback,
        }),
      );
    }
    if (question.highlightArea) {
      list.push({
        id: "area",
        geometry: question.highlightArea,
        color: "#8b5cf6",
        width: 3,
      });
    }
    if (feedback && question.correctOptionId) {
      const street = city.streetById.get(question.correctOptionId);
      if (street) {
        list.push({
          id: "correct",
          geometry: street.geojson,
          color: "#22c55e",
          width: 6,
          animated: true,
        });
      }
    }
    return list;
  }, [question, feedback, city]);

  const fitGeometries = useMemo(() => {
    const geoms = highlights.map((h) => h.geometry);
    return geoms.length > 0 ? geoms : null;
  }, [highlights]);

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <CityMap
          center={city.city.center}
          bbox={city.city.bbox}
          styleId="no-labels"
          highlights={highlights}
          fitTo={fitGeometries}
          fitPadding={80}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2">
        {question.options?.map((option, i) => {
          const isCorrect = option.id === question.correctOptionId;
          const isPicked = feedback?.givenAnswer === option.id;
          return (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              disabled={Boolean(feedback)}
              onClick={() =>
                onAnswer(scoreChoice(question, option.id, Date.now() - questionStartedAt))
              }
              className={cn(
                "rounded-2xl border-2 border-b-4 bg-card px-4 py-3 text-left text-sm font-bold transition-all cursor-pointer",
                !feedback && "hover:border-primary hover:bg-accent active:border-b-2",
                feedback && isCorrect && "border-primary bg-accent text-accent-foreground",
                feedback &&
                  isPicked &&
                  !isCorrect &&
                  "border-destructive bg-destructive/10 text-destructive animate-shake",
                feedback && !isCorrect && !isPicked && "opacity-50",
              )}
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
