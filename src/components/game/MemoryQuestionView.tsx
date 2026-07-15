"use client";

import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CityMap, type MapHighlight, type MapMarker } from "@/components/map/CityMap";
import { sounds } from "@/lib/sound";
import type { CityData } from "@/domains/cities/types";
import { distanceToStreet } from "@/domains/game/geo";
import { scoreMemory } from "@/domains/game/scoring";
import type { LngLat } from "@/types/geo";
import type { Question, QuestionResult } from "@/types/game";

const MEMORIZE_SECONDS = 5;
const MAX_MISSES = 3;
const HIT_DISTANCE_M = 90;

interface Props {
  city: CityData;
  question: Question;
  questionStartedAt: number;
  feedback: QuestionResult | null;
  onAnswer: (result: QuestionResult) => void;
}

/** visual_memory: streets flash for 5 seconds, then find them from memory. */
export function MemoryQuestionView({
  city,
  question,
  questionStartedAt,
  feedback,
  onAnswer,
}: Props) {
  const [phase, setPhase] = useState<"memorize" | "recall">("memorize");
  const [countdown, setCountdown] = useState(MEMORIZE_SECONDS);
  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [lastMiss, setLastMiss] = useState<LngLat | null>(null);

  const streets = useMemo(() => question.memoryStreets ?? [], [question]);

  useEffect(() => {
    if (phase !== "memorize") return;
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setPhase("recall");
          return 0;
        }
        sounds.tick();
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [phase]);

  const highlights = useMemo(() => {
    const list: MapHighlight[] = [];
    if (phase === "memorize" || feedback) {
      streets.forEach((s, i) =>
        list.push({
          id: `mem-${s.id}`,
          geometry: s.geometry,
          color: feedback
            ? foundIds.includes(s.id)
              ? "#22c55e"
              : "#ef4444"
            : ["#a855f7", "#3b82f6", "#f59e0b", "#ec4899", "#14b8a6"][i % 5],
          width: 6,
          animated: phase === "memorize",
        }),
      );
    } else {
      for (const id of foundIds) {
        const s = streets.find((m) => m.id === id);
        if (s) {
          list.push({ id: `found-${id}`, geometry: s.geometry, color: "#22c55e", width: 6 });
        }
      }
    }
    return list;
  }, [phase, feedback, streets, foundIds]);

  const markers: MapMarker[] = lastMiss
    ? [{ id: "miss", point: lastMiss, emoji: "❌", color: "#ef4444" }]
    : [];

  const finish = (found: string[], missCount: number) => {
    onAnswer(scoreMemory(question, found, missCount, Date.now() - questionStartedAt));
  };

  const handleClick = (lngLat: LngLat) => {
    if (phase !== "recall" || feedback) return;
    const hit = streets.find((s) => {
      if (foundIds.includes(s.id)) return false;
      const street = city.streetById.get(s.id);
      return street && distanceToStreet(lngLat, street) < HIT_DISTANCE_M;
    });
    if (hit) {
      sounds.correct();
      const nextFound = [...foundIds, hit.id];
      setFoundIds(nextFound);
      setLastMiss(null);
      if (nextFound.length === streets.length) finish(nextFound, misses);
    } else {
      sounds.wrong();
      setLastMiss(lngLat);
      const nextMisses = misses + 1;
      setMisses(nextMisses);
      if (nextMisses >= MAX_MISSES) finish(foundIds, nextMisses);
    }
  };

  return (
    <div className="relative h-full">
      <CityMap
        center={city.city.center}
        bbox={city.city.bbox}
        styleId="no-labels"
        highlights={highlights}
        markers={markers}
        fitTo={streets.length > 0 ? streets.map((s) => s.geometry) : null}
        fitPadding={90}
        onMapClick={handleClick}
      />
      <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
        {phase === "memorize" ? (
          <motion.div
            key={countdown}
            initial={{ scale: 1.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border-2 bg-card/95 px-5 py-2 text-lg font-extrabold shadow-xl backdrop-blur"
          >
            👀 Memoriza... {countdown}
          </motion.div>
        ) : (
          !feedback && (
            <div className="flex items-center gap-2 rounded-2xl border-2 bg-card/95 px-4 py-2 shadow-xl backdrop-blur">
              <Badge>
                {foundIds.length}/{streets.length} encontradas
              </Badge>
              <Badge variant={misses > 0 ? "destructive" : "muted"}>
                {MAX_MISSES - misses} intentos
              </Badge>
            </div>
          )
        )}
      </div>
    </div>
  );
}
