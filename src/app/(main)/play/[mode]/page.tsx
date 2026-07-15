"use client";

import { notFound, useParams } from "next/navigation";
import { GameSession } from "@/components/game/GameSession";
import { Skeleton } from "@/components/ui/skeleton";
import { useCityData } from "@/domains/cities/hooks";
import { GAME_MODES, type QuestionType } from "@/types/game";

export default function GameModePage() {
  const params = useParams<{ mode: string }>();
  const { data: city, isLoading, error } = useCityData();

  const mode = params.mode as QuestionType;
  const valid = GAME_MODES.some(
    (m) => m.type === mode && m.type !== "official_exam" && m.type !== "ai_examiner",
  );
  if (!valid) notFound();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <Skeleton className="h-10" />
        <Skeleton className="min-h-0 flex-1" />
      </div>
    );
  }
  if (error || !city) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center font-bold text-destructive">
        No se pudo cargar la ciudad. Comprueba tu conexión o la configuración de Supabase.
      </div>
    );
  }

  return <GameSession city={city} mode={mode} />;
}
