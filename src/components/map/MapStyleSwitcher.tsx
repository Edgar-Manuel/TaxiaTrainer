"use client";

import { LayersIcon, MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettings, type MapStyleId } from "@/stores/settings-store";

const STYLES: { id: MapStyleId; label: string }[] = [
  { id: "streets", label: "Callejero" },
  { id: "no-labels", label: "Sin nombres" },
  { id: "satellite", label: "Satélite" },
];

export function MapStyleSwitcher({ className }: { className?: string }) {
  const { mapStyle, setMapStyle, theme, setTheme } = useSettings();

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-2xl border-2 bg-card/90 p-1 shadow-lg backdrop-blur",
        className,
      )}
    >
      <LayersIcon className="ml-1.5 size-4 text-muted-foreground" />
      {STYLES.map((s) => (
        <button
          key={s.id}
          onClick={() => setMapStyle(s.id)}
          className={cn(
            "rounded-xl px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer",
            mapStyle === s.id
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          {s.label}
        </button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        className="size-7"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Cambiar tema"
      >
        {theme === "dark" ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
      </Button>
    </div>
  );
}
