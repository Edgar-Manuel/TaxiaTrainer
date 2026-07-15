"use client";

import { useState } from "react";
import { GameSession } from "@/components/game/GameSession";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EXAM } from "@/lib/config";
import { formatClock } from "@/lib/utils";
import { useCityData } from "@/domains/cities/hooks";

export default function ExamPage() {
  const { data: city, isLoading } = useCityData();
  const [started, setStarted] = useState(false);

  if (isLoading || !city) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (started) return <GameSession city={city} mode="official_exam" />;

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="text-7xl">📝</div>
      <h1 className="text-3xl font-black">Examen oficial simulado</h1>
      <p className="max-w-md font-semibold text-muted-foreground">
        Simulacro del examen del permiso municipal de taxista de {city.city.name}:
        preguntas aleatorias de todos los tipos con cronómetro y un informe final por
        categorías.
      </p>
      <Card className="w-full max-w-sm">
        <CardContent className="space-y-2 p-5 text-left text-sm font-bold">
          <div className="flex justify-between">
            <span>Preguntas</span>
            <span>{EXAM.questionCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Tiempo límite</span>
            <span>{formatClock(EXAM.timeLimitS)}</span>
          </div>
          <div className="flex justify-between">
            <span>Nota de corte</span>
            <span>{Math.round(EXAM.passPct * 100)}%</span>
          </div>
        </CardContent>
      </Card>
      <Button size="lg" onClick={() => setStarted(true)}>
        Comenzar examen
      </Button>
    </div>
  );
}
