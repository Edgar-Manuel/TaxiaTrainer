"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { levelForXp, xpForLevel } from "@/lib/config";
import { todayISO } from "@/lib/utils";
import { useCityData } from "@/domains/cities/hooks";
import { masteryBand } from "@/domains/srs/sm2";
import { useProgress } from "@/stores/progress-store";
import { GAME_MODES } from "@/types/game";

export default function DashboardPage() {
  const { data: city, isLoading } = useCityData();
  const progress = useProgress();

  const level = levelForXp(progress.xp);
  const levelStart = xpForLevel(level);
  const levelEnd = xpForLevel(level + 1);
  const levelPct = Math.min(
    100,
    Math.round(((progress.xp - levelStart) / (levelEnd - levelStart)) * 100),
  );

  const today = progress.studyDays[todayISO()];
  const dailyPct = Math.min(
    100,
    Math.round(((today?.xp ?? 0) / progress.dailyGoalXp) * 100),
  );

  const streetStats = { mastered: 0, learning: 0, weak: 0 };
  if (city) {
    for (const street of city.streets) {
      const band = masteryBand(progress.mastery[`street:${street.id}`]);
      if (band === "mastered") streetStats.mastered++;
      else if (band === "learning") streetStats.learning++;
      else if (band === "weak") streetStats.weak++;
    }
  }
  const dominationPct = city
    ? Math.round((streetStats.mastered / Math.max(1, city.streets.length)) * 100)
    : 0;

  const dueCount = city
    ? progress.dueTargets("street").filter((id) => city.streetById.has(id)).length
    : 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">
          ¡Hola! 👋 {city ? `Hoy toca ${city.city.name}` : ""}
        </h1>
        <p className="mt-1 font-semibold text-muted-foreground">
          Racha de {progress.streakCurrent} {progress.streakCurrent === 1 ? "día" : "días"} 🔥 · Nivel {level}
        </p>
      </div>

      {/* Daily goal + level */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>🎯 Objetivo diario</span>
              <span className="text-sm font-bold text-muted-foreground">
                {today?.xp ?? 0}/{progress.dailyGoalXp} XP
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={dailyPct} />
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {dailyPct >= 100
                ? "¡Objetivo cumplido! 🎉 Sigue si quieres más XP."
                : `Te faltan ${progress.dailyGoalXp - (today?.xp ?? 0)} XP para mantener la racha.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>⭐ Nivel {level}</span>
              <span className="text-sm font-bold text-muted-foreground">
                {progress.xp - levelStart}/{levelEnd - levelStart} XP
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Progress value={levelPct} indicatorClassName="bg-secondary" />
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              {levelEnd - progress.xp} XP para el nivel {level + 1}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* City domination */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between">
            <span>🏙️ Dominio de {city?.city.name ?? "la ciudad"}</span>
            <span className="text-2xl font-black text-primary">{dominationPct}%</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !city ? (
            <Skeleton className="h-12" />
          ) : (
            <>
              <div className="flex h-4 overflow-hidden rounded-full bg-muted">
                <div
                  className="bg-[#22c55e]"
                  style={{ width: `${(streetStats.mastered / city.streets.length) * 100}%` }}
                />
                <div
                  className="bg-[#eab308]"
                  style={{ width: `${(streetStats.learning / city.streets.length) * 100}%` }}
                />
                <div
                  className="bg-[#ef4444]"
                  style={{ width: `${(streetStats.weak / city.streets.length) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted-foreground">
                <span>🟢 {streetStats.mastered} dominadas</span>
                <span>🟡 {streetStats.learning} aprendiendo</span>
                <span>🔴 {streetStats.weak} débiles</span>
                <span>
                  ⚪{" "}
                  {city.streets.length -
                    streetStats.mastered -
                    streetStats.learning -
                    streetStats.weak}{" "}
                  sin ver
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Review reminder */}
      {dueCount > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-warning bg-warning/10">
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <div className="font-extrabold">🧠 Repaso pendiente</div>
                <p className="text-sm font-semibold text-muted-foreground">
                  {dueCount} {dueCount === 1 ? "calle espera" : "calles esperan"} tu
                  repaso según la repetición espaciada.
                </p>
              </div>
              <Button asChild>
                <Link href="/play/find_street">Repasar</Link>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 text-lg font-extrabold">Entrenamiento rápido</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GAME_MODES.slice(0, 4).map((mode) => (
            <Link
              key={mode.type}
              href={`/play/${mode.type}`}
              className="rounded-2xl border-2 border-b-4 bg-card p-4 text-center transition-all hover:border-primary active:border-b-2"
            >
              <div className="text-3xl">{mode.icon}</div>
              <div className="mt-1 text-xs font-extrabold">{mode.title}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
