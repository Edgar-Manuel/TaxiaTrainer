"use client";

import { SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { askExplanation, useAiAvailable } from "@/domains/ai/client";
import type { CityData } from "@/domains/cities/types";
import type { QuestionResult } from "@/types/game";

interface Props {
  city: CityData;
  result: QuestionResult;
}

function describeAnswer(city: CityData, result: QuestionResult): {
  correct: string;
  given: string;
} {
  const { question, givenAnswer } = result;
  if (question.correctOptionId) {
    return {
      correct:
        question.options?.find((o) => o.id === question.correctOptionId)?.label ?? "",
      given:
        question.options?.find((o) => o.id === givenAnswer)?.label ??
        String(givenAnswer),
    };
  }
  const target =
    city.streetById.get(question.targetIds[0])?.name ??
    city.placeById.get(question.targetIds[0])?.name ??
    question.prompt;
  return {
    correct: target,
    given: result.distanceM !== undefined ? `a ${result.distanceM} m del objetivo` : "mi intento",
  };
}

/** "Why?" button: asks the AI tutor to explain a failed answer. */
export function AiExplainButton({ city, result }: Props) {
  const { data: available } = useAiAvailable();
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!available || result.correct) return null;

  if (explanation) {
    return (
      <p className="mt-2 rounded-xl bg-card/70 p-2.5 text-xs font-semibold">
        🧠 {explanation}
      </p>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={loading}
      className="mt-2"
      onClick={async () => {
        setLoading(true);
        try {
          const { correct, given } = describeAnswer(city, result);
          setExplanation(
            await askExplanation({
              cityName: city.city.name,
              questionPrompt: result.question.prompt,
              questionType: result.question.type,
              correctAnswer: correct,
              userAnswer: given,
            }),
          );
        } catch {
          setExplanation("No se pudo obtener la explicación. Inténtalo de nuevo.");
        } finally {
          setLoading(false);
        }
      }}
    >
      <SparklesIcon /> {loading ? "Pensando..." : "¿Por qué?"}
    </Button>
  );
}
