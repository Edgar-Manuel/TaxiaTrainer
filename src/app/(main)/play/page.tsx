"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useCityData } from "@/domains/cities/hooks";
import { GAME_MODES } from "@/types/game";

export default function PlayPage() {
  const { data: city, isLoading } = useCityData();

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <h1 className="text-2xl font-black md:text-3xl">Modos de entrenamiento</h1>
      <p className="mt-1 font-semibold text-muted-foreground">
        {city
          ? `${city.city.name} · ${city.streets.length} calles · ${city.places.length} lugares`
          : "Cargando ciudad..."}
      </p>

      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_MODES.map((mode, i) => (
            <motion.div
              key={mode.type}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Link
                href={
                  mode.type === "official_exam"
                    ? "/exam"
                    : mode.type === "ai_examiner"
                      ? "/examiner"
                      : `/play/${mode.type}`
                }
                className="group block h-full rounded-3xl border-2 border-b-4 bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary active:border-b-2"
              >
                <div
                  className={`inline-flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl ${mode.color}`}
                >
                  {mode.icon}
                </div>
                <h3 className="mt-3 text-lg font-extrabold group-hover:text-primary">
                  {mode.title}
                </h3>
                <p className="mt-1 text-sm font-semibold text-muted-foreground">
                  {mode.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
