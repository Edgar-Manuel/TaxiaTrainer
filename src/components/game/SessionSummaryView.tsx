"use client";

import confetti from "canvas-confetti";
import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatClock } from "@/lib/utils";
import { sounds } from "@/lib/sound";
import type { RecordedSession } from "@/stores/progress-store";
import type { SessionSummary } from "@/types/game";

interface Props {
  summary: SessionSummary;
  session: RecordedSession;
  isExam: boolean;
  passed?: boolean;
  onRetry: () => void;
}

export function SessionSummaryView({ summary, session, isExam, passed, onRetry }: Props) {
  const accuracy = Math.round(summary.accuracy * 100);
  const perfect = summary.accuracy === 1 && summary.results.length > 0;

  useEffect(() => {
    sounds.finish();
    if (perfect || passed) {
      confetti({ particleCount: 160, spread: 80, origin: { y: 0.6 } });
      setTimeout(
        () => confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0 } }),
        300,
      );
      setTimeout(
        () => confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1 } }),
        500,
      );
    }
  }, [perfect, passed]);

  const stats = [
    { label: "Precisión", value: `${accuracy}%`, icon: "🎯" },
    { label: "XP ganada", value: `+${session.xpEarned}`, icon: "⚡" },
    { label: "Tiempo", value: formatClock(summary.durationS), icon: "⏱️" },
    {
      label: "Aciertos",
      value: `${summary.results.filter((r) => r.correct).length}/${summary.results.length}`,
      icon: "✅",
    },
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-6">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0.5 }}
        className="text-center"
      >
        <div className="text-7xl">
          {isExam ? (passed ? "🎓" : "📚") : perfect ? "🏆" : accuracy >= 70 ? "🎉" : "💪"}
        </div>
        <h2 className="mt-3 text-3xl font-black">
          {isExam
            ? passed
              ? "¡APTO!"
              : "No apto... todavía"
            : perfect
              ? "¡Sesión perfecta!"
              : accuracy >= 70
                ? "¡Buen trabajo!"
                : "Sigue practicando"}
        </h2>
        {isExam && (
          <p className="mt-1 text-muted-foreground">
            {passed
              ? "Has superado el simulacro de examen oficial."
              : "Necesitas un 75% para aprobar. Repasa tus puntos débiles."}
          </p>
        )}
      </motion.div>

      <div className="grid w-full max-w-md grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 + i * 0.1 }}
          >
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <span className="text-2xl">{stat.icon}</span>
                <div>
                  <div className="text-xl font-black">{stat.value}</div>
                  <div className="text-xs font-semibold text-muted-foreground">
                    {stat.label}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {isExam && (
        <ExamReport summary={summary} />
      )}

      <div className="flex gap-3">
        <Button variant="outline" asChild>
          <Link href="/play">Elegir otro modo</Link>
        </Button>
        <Button onClick={onRetry}>{isExam ? "Repetir examen" : "Otra ronda"}</Button>
      </div>
    </div>
  );
}

function ExamReport({ summary }: { summary: SessionSummary }) {
  const byType = new Map<string, { correct: number; total: number }>();
  for (const result of summary.results) {
    const entry = byType.get(result.question.type) ?? { correct: 0, total: 0 };
    entry.total++;
    if (result.correct) entry.correct++;
    byType.set(result.question.type, entry);
  }

  return (
    <Card className="w-full max-w-md">
      <CardContent className="p-4">
        <h3 className="mb-2 text-sm font-extrabold uppercase text-muted-foreground">
          Informe por tipo de pregunta
        </h3>
        <div className="space-y-1.5">
          {[...byType.entries()].map(([type, { correct, total }]) => (
            <div key={type} className="flex items-center justify-between text-sm">
              <span className="font-semibold">{TYPE_LABELS[type] ?? type}</span>
              <span
                className={
                  correct === total
                    ? "font-bold text-primary"
                    : correct === 0
                      ? "font-bold text-destructive"
                      : "font-bold text-warning-foreground"
                }
              >
                {correct}/{total}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const TYPE_LABELS: Record<string, string> = {
  find_street: "Encuentra la calle",
  name_street: "¿Qué calle es?",
  complete_route: "Recorridos",
  visual_memory: "Memoria visual",
  guess_neighborhood: "Barrios",
  find_place: "Lugares",
  crossing_street: "Cruces",
  nearby_street: "Calles cercanas",
  parallel_street: "Paralelas",
  flows_into: "Desembocaduras",
  fastest_route: "Ruta más rápida",
};
