"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDuration } from "@/lib/utils";
import { useCityData } from "@/domains/cities/hooks";
import { masteryBand } from "@/domains/srs/sm2";
import { useProgress } from "@/stores/progress-store";

const TYPE_LABELS: Record<string, string> = {
  find_street: "Encontrar calle",
  name_street: "¿Qué calle es?",
  complete_route: "Recorridos",
  visual_memory: "Memoria",
  guess_neighborhood: "Barrios",
  find_place: "Lugares",
  crossing_street: "Cruces",
  nearby_street: "Cercanas",
  parallel_street: "Paralelas",
  flows_into: "Desembocaduras",
  fastest_route: "Ruta rápida",
};

export default function StatsPage() {
  const { data: city, isLoading } = useCityData();
  const progress = useProgress();

  const stats = useMemo(() => {
    const totalTimeS = Object.values(progress.studyDays).reduce(
      (sum, d) => sum + d.timeS,
      0,
    );
    const totalAnswers = progress.answers.length;
    const totalCorrect = progress.answers.filter((a) => a.correct).length;
    const avgTimeMs =
      totalAnswers > 0
        ? progress.answers.reduce((sum, a) => sum + a.timeMs, 0) / totalAnswers
        : 0;

    let known = 0;
    let pending = 0;
    if (city) {
      for (const street of city.streets) {
        const band = masteryBand(progress.mastery[`street:${street.id}`]);
        if (band === "mastered" || band === "learning") known++;
        else pending++;
      }
    }
    return { totalTimeS, totalAnswers, totalCorrect, avgTimeMs, known, pending };
  }, [progress, city]);

  const xpByDay = useMemo(() => {
    const days: { day: string; xp: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86_400_000);
      const key = date.toISOString().slice(0, 10);
      days.push({
        day: date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }),
        xp: progress.studyDays[key]?.xp ?? 0,
      });
    }
    return days;
  }, [progress.studyDays]);

  const accuracyByType = useMemo(() => {
    const byType = new Map<string, { correct: number; total: number }>();
    for (const answer of progress.answers) {
      const entry = byType.get(answer.questionType) ?? { correct: 0, total: 0 };
      entry.total++;
      if (answer.correct) entry.correct++;
      byType.set(answer.questionType, entry);
    }
    return [...byType.entries()]
      .map(([type, { correct, total }]) => ({
        type: TYPE_LABELS[type] ?? type,
        precision: Math.round((correct / total) * 100),
        total,
      }))
      .sort((a, b) => a.precision - b.precision);
  }, [progress.answers]);

  const byNeighborhood = useMemo(() => {
    if (!city) return [];
    return city.neighborhoods
      .map((nb) => {
        const streets = city.streets.filter((s) => s.neighborhood_id === nb.id);
        const mastered = streets.filter(
          (s) => masteryBand(progress.mastery[`street:${s.id}`]) === "mastered",
        ).length;
        return {
          name: nb.name,
          dominio: streets.length > 0 ? Math.round((mastered / streets.length) * 100) : 0,
          calles: streets.length,
        };
      })
      .sort((a, b) => b.dominio - a.dominio);
  }, [city, progress.mastery]);

  const frequentErrors = useMemo(() => {
    if (!city) return [];
    const fails = new Map<string, number>();
    for (const answer of progress.answers) {
      if (answer.correct || !answer.targetId) continue;
      fails.set(answer.targetId, (fails.get(answer.targetId) ?? 0) + 1);
    }
    return [...fails.entries()]
      .map(([id, count]) => ({
        name:
          city.streetById.get(id)?.name ??
          city.placeById.get(id)?.name ??
          city.neighborhoodById.get(id)?.name ??
          "—",
        count,
      }))
      .filter((e) => e.name !== "—")
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [city, progress.answers]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-8">
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const tiles = [
    { label: "Horas estudiadas", value: formatDuration(stats.totalTimeS), icon: "⏱️" },
    {
      label: "Precisión global",
      value:
        stats.totalAnswers > 0
          ? `${Math.round((stats.totalCorrect / stats.totalAnswers) * 100)}%`
          : "—",
      icon: "🎯",
    },
    { label: "Calles conocidas", value: String(stats.known), icon: "🟢" },
    { label: "Calles pendientes", value: String(stats.pending), icon: "⚪" },
    {
      label: "Tiempo medio / pregunta",
      value: stats.avgTimeMs > 0 ? `${(stats.avgTimeMs / 1000).toFixed(1)}s` : "—",
      icon: "⚡",
    },
    { label: "Respuestas totales", value: String(stats.totalAnswers), icon: "📊" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-black md:text-3xl">Estadísticas</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="p-4">
              <div className="text-xs font-bold text-muted-foreground">
                {tile.icon} {tile.label}
              </div>
              <div className="mt-1 text-2xl font-black">{tile.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>XP en los últimos 14 días</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={xpByDay} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                interval={1}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "2px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  fontWeight: 700,
                }}
              />
              <Bar dataKey="xp" name="XP" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {accuracyByType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Precisión por tipo de pregunta</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={accuracyByType}
                layout="vertical"
                margin={{ top: 4, right: 36, left: 8, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--border)" />
                <XAxis type="number" domain={[0, 100]} hide />
                <YAxis
                  type="category"
                  dataKey="type"
                  width={110}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)", fontWeight: 700 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)" }}
                  formatter={(value) => [`${value}%`, "Precisión"]}
                  contentStyle={{
                    borderRadius: 12,
                    border: "2px solid var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                    fontWeight: 700,
                  }}
                />
                <Bar
                  dataKey="precision"
                  fill="var(--chart-2)"
                  radius={[0, 4, 4, 0]}
                  maxBarSize={18}
                  label={{
                    position: "right",
                    formatter: (v) => `${v}%`,
                    fontSize: 11,
                    fontWeight: 800,
                    fill: "var(--foreground)",
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {byNeighborhood.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Dominio por barrio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {byNeighborhood.map((nb) => (
              <div key={nb.name}>
                <div className="mb-1 flex justify-between text-sm font-bold">
                  <span>{nb.name}</span>
                  <span className="text-muted-foreground">
                    {nb.dominio}% · {nb.calles} calles
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${nb.dominio}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {frequentErrors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Errores más frecuentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {frequentErrors.map((error, i) => (
                <div
                  key={error.name}
                  className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-sm font-bold"
                >
                  <span>
                    {i + 1}. {error.name}
                  </span>
                  <span className="text-destructive">
                    {error.count} {error.count === 1 ? "fallo" : "fallos"}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-muted-foreground">
              💡 La repetición espaciada ya está priorizando estas calles en tus
              próximas sesiones.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
