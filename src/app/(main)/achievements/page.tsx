"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ACHIEVEMENTS } from "@/domains/gamification/achievements";
import { useProgress } from "@/stores/progress-store";

export default function AchievementsPage() {
  const unlocked = useProgress((s) => s.achievements);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-black md:text-3xl">Logros</h1>
      <p className="mt-1 font-semibold text-muted-foreground">
        {unlocked.length} de {ACHIEVEMENTS.length} desbloqueados
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {ACHIEVEMENTS.map((achievement, i) => {
          const isUnlocked = unlocked.includes(achievement.code);
          return (
            <motion.div
              key={achievement.code}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
            >
              <Card
                className={cn(
                  "h-full text-center transition-transform hover:-translate-y-0.5",
                  !isUnlocked && "opacity-45 grayscale",
                )}
              >
                <CardContent className="p-4">
                  <div className={cn("text-4xl", isUnlocked && "animate-float")}>
                    {achievement.icon}
                  </div>
                  <div className="mt-2 text-sm font-extrabold">{achievement.name}</div>
                  <div className="mt-1 text-xs font-semibold text-muted-foreground">
                    {achievement.description}
                  </div>
                  <div
                    className={cn(
                      "mt-2 text-xs font-black",
                      isUnlocked ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {isUnlocked ? "✓ Conseguido" : `+${achievement.xpReward} XP`}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
