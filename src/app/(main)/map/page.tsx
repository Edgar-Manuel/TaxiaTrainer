"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CityMap, type MapHighlight } from "@/components/map/CityMap";
import { MapStyleSwitcher } from "@/components/map/MapStyleSwitcher";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCityData } from "@/domains/cities/hooks";
import { MASTERY_COLORS, masteryBand } from "@/domains/srs/sm2";
import { useProgress } from "@/stores/progress-store";

type Layer = "mastery" | "errors" | "places";

/** Free exploration map: mastery colours, error heatmap and places. */
export default function MapPage() {
  const { data: city, isLoading } = useCityData();
  const mastery = useProgress((s) => s.mastery);
  const answers = useProgress((s) => s.answers);
  const [layer, setLayer] = useState<Layer>("mastery");

  const highlights = useMemo<MapHighlight[]>(() => {
    if (!city || layer !== "mastery") return [];
    return city.streets.map((street) => {
      const band = masteryBand(mastery[`street:${street.id}`]);
      return {
        id: street.id,
        geometry: street.geojson,
        color: MASTERY_COLORS[band],
        width: band === "unseen" ? 2 : 4,
        opacity: band === "unseen" ? 0.4 : 0.85,
      };
    });
  }, [city, mastery, layer]);

  const heatmapPoints = useMemo(() => {
    if (layer !== "errors") return [];
    return answers.filter((a) => !a.correct && a.location).map((a) => a.location!);
  }, [answers, layer]);

  const markers = useMemo(() => {
    if (!city || layer !== "places") return [];
    return city.places.map((p) => ({
      id: p.id,
      point: p.point,
      label: p.name,
      emoji: CATEGORY_EMOJI[p.category] ?? "📍",
    }));
  }, [city, layer]);

  if (isLoading || !city) {
    return (
      <div className="h-full p-4">
        <Skeleton className="h-full" />
      </div>
    );
  }

  return (
    <div className="relative h-full">
      <CityMap
        center={city.city.center}
        bbox={city.city.bbox}
        highlights={highlights}
        heatmapPoints={heatmapPoints}
        markers={markers}
      />
      <div className="absolute left-3 top-3 flex flex-col gap-2">
        <div className="flex gap-1 rounded-2xl border-2 bg-card/90 p-1 shadow-lg backdrop-blur">
          {(
            [
              ["mastery", "🎨 Dominio"],
              ["errors", "🔥 Errores"],
              ["places", "📍 Lugares"],
            ] as [Layer, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setLayer(id)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer",
                layer === id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {layer === "mastery" && (
          <div className="flex flex-col gap-1 rounded-2xl border-2 bg-card/90 p-2.5 text-xs font-bold shadow-lg backdrop-blur">
            <Badge className="bg-[#22c55e]">Dominada</Badge>
            <Badge className="bg-[#eab308] text-black">Aprendiendo</Badge>
            <Badge className="bg-[#ef4444]">Débil</Badge>
            <Badge variant="muted">Sin ver</Badge>
          </div>
        )}
      </div>
      <MapStyleSwitcher className="absolute bottom-6 left-1/2 -translate-x-1/2" />
    </div>
  );
}

const CATEGORY_EMOJI: Record<string, string> = {
  hospital: "🏥",
  hotel: "🏨",
  beach: "🏖️",
  official_building: "🏛️",
  station: "🚉",
  university: "🎓",
  monument: "🗿",
  mall: "🛍️",
  police: "👮",
  fire_station: "🚒",
  court: "⚖️",
  market: "🧺",
  park: "🌳",
  square: "⛲",
  other: "📍",
};
