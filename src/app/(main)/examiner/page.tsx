"use client";

import { AnimatePresence, motion } from "framer-motion";
import { EyeIcon, EyeOffIcon, MicIcon, RefreshCwIcon, SendIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CityMap, type MapHighlight, type MapMarker } from "@/components/map/CityMap";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, pickRandom } from "@/lib/utils";
import { createRecognizer, speak, speechRecognitionSupported, stopSpeaking } from "@/lib/voice";
import { askExaminer, useAiAvailable, type ExaminerMessage } from "@/domains/ai/client";
import { useCityData } from "@/domains/cities/hooks";
import type { CityData } from "@/domains/cities/types";
import { buildRouteGraph, shortestRoute } from "@/domains/game/geo";
import { useSettings } from "@/stores/settings-store";
import type { LngLat } from "@/types/geo";

interface Exercise {
  originName: string;
  originPoint: LngLat;
  destName: string;
  destPoint: LngLat;
  routePoints: LngLat[];
  routeStreets: string[];
}

function buildExercise(city: CityData): Exercise | null {
  const graph = buildRouteGraph(city);
  for (let attempt = 0; attempt < 15; attempt++) {
    const [origin, destination] = pickRandom(city.places, 2);
    if (!origin || !destination) return null;
    const route = shortestRoute(graph, origin.point, destination.point);
    if (!route || route.streetIds.length < 2) continue;
    return {
      originName: origin.name,
      originPoint: origin.point,
      destName: destination.name,
      destPoint: destination.point,
      routePoints: route.points,
      routeStreets: route.streetIds
        .map((id) => city.streetById.get(id)?.name)
        .filter((n): n is string => Boolean(n)),
    };
  }
  return null;
}

function buildContext(city: CityData, exercise: Exercise): string {
  const streets = city.streets.slice(0, 120).map((s) => s.name);
  const places = city.places.slice(0, 60).map((p) => p.name);
  return [
    `Ejercicio actual: llevar al pasajero desde "${exercise.originName}" hasta "${exercise.destName}".`,
    `Ruta óptima (secuencia de calles): ${exercise.routeStreets.join(" → ")}.`,
    `Calles de la ciudad: ${streets.join(", ")}.`,
    `Lugares: ${places.join(", ")}.`,
  ].join("\n");
}

export default function ExaminerPage() {
  const { data: city, isLoading } = useCityData();
  const { data: aiAvailable } = useAiAvailable();
  const voiceEnabled = useSettings((s) => s.voiceEnabled);

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [messages, setMessages] = useState<ExaminerMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [showRoute, setShowRoute] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const newExercise = useMemo(
    () => () => {
      if (!city) return;
      stopSpeaking();
      const ex = buildExercise(city);
      setExercise(ex);
      setShowRoute(false);
      if (ex) {
        const opening = `Buenos días. Lléveme desde ${ex.originName} hasta ${ex.destName}, por favor. Descríbame el recorrido calle a calle.`;
        setMessages([{ role: "assistant", content: opening }]);
        speak(opening, voiceEnabled);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city],
  );

  useEffect(() => {
    if (city && !exercise) newExercise();
  }, [city, exercise, newExercise]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const send = async (text: string) => {
    if (!city || !exercise || !text.trim() || busy) return;
    const next: ExaminerMessage[] = [...messages, { role: "user", content: text.trim() }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const reply = await askExaminer({
        cityName: city.city.name,
        context: buildContext(city, exercise),
        messages: next,
      });
      setMessages([...next, { role: "assistant", content: reply }]);
      setShowRoute(true);
      speak(reply, voiceEnabled);
    } catch (err) {
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `⚠️ ${err instanceof Error ? err.message : "Error de conexión con la IA"}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const listen = () => {
    if (listening) return;
    const recognizer = createRecognizer(
      (transcript) => send(transcript),
      () => setListening(false),
    );
    if (!recognizer) return;
    stopSpeaking();
    setListening(true);
    recognizer.start();
  };

  if (isLoading || !city) {
    return (
      <div className="h-full p-4">
        <Skeleton className="h-full" />
      </div>
    );
  }

  const highlights: MapHighlight[] = [];
  const markers: MapMarker[] = [];
  if (exercise) {
    markers.push(
      { id: "o", point: exercise.originPoint, emoji: "🚕", label: exercise.originName, color: "#3b82f6" },
      { id: "d", point: exercise.destPoint, emoji: "🏁", label: exercise.destName, color: "#22c55e" },
    );
    if (showRoute) {
      highlights.push({
        id: "route",
        geometry: { type: "LineString", coordinates: exercise.routePoints },
        color: "#22c55e",
        width: 6,
        arrows: true,
        animated: true,
      });
    }
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      {/* Map side */}
      <div className="relative h-56 shrink-0 md:h-auto md:flex-1">
        <CityMap
          center={city.city.center}
          bbox={city.city.bbox}
          highlights={highlights}
          markers={markers}
          fitTo={
            exercise
              ? [
                  {
                    type: "LineString",
                    coordinates: [exercise.originPoint, exercise.destPoint],
                  } as GeoJSON.Geometry,
                ]
              : null
          }
          fitPadding={70}
        />
        {exercise && (
          <Button
            size="sm"
            variant="outline"
            className="absolute bottom-3 left-3 bg-card/90 backdrop-blur"
            onClick={() => setShowRoute((v) => !v)}
          >
            {showRoute ? <EyeOffIcon /> : <EyeIcon />}
            Ruta óptima
          </Button>
        )}
      </div>

      {/* Chat side */}
      <div className="flex min-h-0 flex-1 flex-col border-t-2 md:w-105 md:flex-none md:border-l-2 md:border-t-0">
        <div className="flex items-center justify-between border-b-2 bg-card px-4 py-3">
          <div>
            <h1 className="font-black">🎙️ IA examinadora</h1>
            <p className="text-xs font-semibold text-muted-foreground">
              Describe el recorrido con tu voz o por texto
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={newExercise}>
            <RefreshCwIcon /> Nueva ruta
          </Button>
        </div>

        {aiAvailable === false && (
          <Card className="m-3 border-warning bg-warning/10">
            <CardContent className="p-3 text-xs font-semibold">
              ⚠️ La IA no está configurada en el servidor. Añade <code>AI_API_KEY</code>{" "}
              (y opcionalmente <code>AI_BASE_URL</code>/<code>AI_MODEL</code>) para
              activar este modo.
            </CardContent>
          </Card>
        )}

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <AnimatePresence initial={false}>
            {messages.map((message, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "max-w-[85%] rounded-2xl border-2 px-4 py-2.5 text-sm font-semibold whitespace-pre-wrap",
                  message.role === "assistant"
                    ? "bg-card"
                    : "ml-auto border-primary/40 bg-accent",
                )}
              >
                {message.role === "assistant" && <span className="mr-1.5">👨‍🏫</span>}
                {message.content}
              </motion.div>
            ))}
          </AnimatePresence>
          {busy && (
            <div className="flex gap-1.5 rounded-2xl border-2 bg-card px-4 py-3 w-fit">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-2 rounded-full bg-muted-foreground"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                />
              ))}
            </div>
          )}
        </div>

        <form
          className="flex items-center gap-2 border-t-2 bg-card p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          {speechRecognitionSupported() && (
            <Button
              type="button"
              size="icon"
              variant={listening ? "destructive" : "secondary"}
              onClick={listen}
              aria-label="Hablar"
              className={listening ? "animate-pulse" : ""}
            >
              <MicIcon />
            </Button>
          )}
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? "Escuchando..." : "Sigo por la calle..."}
            disabled={busy || aiAvailable === false}
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Enviar">
            <SendIcon />
          </Button>
        </form>
      </div>
    </div>
  );
}
