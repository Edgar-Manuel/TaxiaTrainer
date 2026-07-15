"use client";

import { DownloadIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { isDemoMode } from "@/lib/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAiAvailable } from "@/domains/ai/client";
import { useCities, useCityData } from "@/domains/cities/hooks";

interface GeneratedQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export default function AdminPage() {
  const { data: cities, isLoading, refetch } = useCities();
  const { data: activeCity } = useCityData();
  const { data: aiAvailable } = useAiAvailable();

  const [newCity, setNewCity] = useState({ name: "", slug: "", relation: "" });
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState<GeneratedQuestion[] | null>(null);
  const [generating, setGenerating] = useState(false);

  const addCity = async () => {
    const db = getSupabaseBrowser();
    if (!db || !newCity.name || !newCity.slug) return;
    setSaving(true);
    try {
      await db.from("cities").insert({
        name: newCity.name,
        slug: newCity.slug,
        osm_relation_id: newCity.relation ? Number(newCity.relation) : null,
        center: [0, 0],
        status: "draft",
        published: false,
      });
      setNewCity({ name: "", slug: "", relation: "" });
      refetch();
    } finally {
      setSaving(false);
    }
  };

  const exportCity = () => {
    if (!activeCity) return;
    const payload = {
      city: activeCity.city,
      streets: activeCity.streets,
      neighborhoods: activeCity.neighborhoods,
      places: activeCity.places,
      intersections: activeCity.intersections,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCity.city.slug}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateQuestions = async (topic: "callejero" | "reglamento") => {
    if (!activeCity) return;
    setGenerating(true);
    setGenerated(null);
    try {
      const res = await fetch("/api/ai/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityName: activeCity.city.name,
          topic,
          streetNames: activeCity.streets.slice(0, 120).map((s) => s.name),
          placeNames: activeCity.places.slice(0, 80).map((p) => p.name),
          count: 8,
        }),
      });
      const data = await res.json();
      setGenerated(data.questions ?? []);
    } catch {
      setGenerated([]);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-black md:text-3xl">Panel de administración</h1>

      {isDemoMode && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="p-4 text-sm font-semibold">
            ⚠️ Modo demo: la gestión de ciudades requiere Supabase configurado. Aun
            así puedes exportar el dataset actual y generar preguntas con IA.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Ciudades</CardTitle>
          <CardDescription>
            El sistema es 100% multiciudad: añade una fila y ejecuta el importador.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-16" />
          ) : (
            (cities ?? []).map((city) => (
              <div
                key={city.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3"
              >
                <div className="font-extrabold">
                  {city.name}{" "}
                  <span className="text-xs font-semibold text-muted-foreground">
                    /{city.slug}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <Badge variant={city.status === "ready" ? "default" : "warning"}>
                    {city.status === "ready" ? "Lista" : city.status}
                  </Badge>
                  <span className="text-muted-foreground">
                    {city.streets_count} calles · {city.places_count} lugares
                  </span>
                </div>
              </div>
            ))
          )}

          <div className="rounded-2xl bg-muted/60 p-4">
            <div className="text-sm font-extrabold">Añadir ciudad</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Input
                placeholder="Nombre (Madrid)"
                value={newCity.name}
                onChange={(e) => setNewCity({ ...newCity, name: e.target.value })}
              />
              <Input
                placeholder="Slug (madrid)"
                value={newCity.slug}
                onChange={(e) => setNewCity({ ...newCity, slug: e.target.value })}
              />
              <Input
                placeholder="Relación OSM (opcional)"
                value={newCity.relation}
                onChange={(e) => setNewCity({ ...newCity, relation: e.target.value })}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button size="sm" onClick={addCity} disabled={isDemoMode || saving}>
                {saving ? "Guardando..." : "Crear ciudad"}
              </Button>
              <code className="rounded-lg bg-background px-2 py-1 text-xs font-bold">
                npm run import:city -- --slug {newCity.slug || "madrid"}
                {newCity.relation ? ` --relation ${newCity.relation}` : ` --name "${newCity.name || "Madrid"}"`}
              </code>
            </div>
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              El importador descarga de OpenStreetMap todas las calles, geometrías,
              barrios, cruces, sentidos y lugares, y los guarda en Supabase.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={exportCity} disabled={!activeCity}>
            <DownloadIcon /> Exportar ciudad activa (JSON)
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <SparklesIcon className="mr-1 inline size-5" /> Generador de preguntas con IA
          </CardTitle>
          <CardDescription>
            Amplía el banco de preguntas con la IA: callejero real o reglamento del taxi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!aiAvailable || generating}
              onClick={() => generateQuestions("callejero")}
            >
              Sobre el callejero
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!aiAvailable || generating}
              onClick={() => generateQuestions("reglamento")}
            >
              Sobre el reglamento
            </Button>
          </div>
          {!aiAvailable && (
            <p className="mt-2 text-xs font-semibold text-muted-foreground">
              Configura AI_API_KEY para activar la generación.
            </p>
          )}
          {generating && <Skeleton className="mt-4 h-32" />}
          {generated && (
            <div className="mt-4 space-y-3">
              {generated.length === 0 && (
                <p className="text-sm font-semibold text-destructive">
                  No se pudieron generar preguntas.
                </p>
              )}
              {generated.map((q, i) => (
                <div key={i} className="rounded-2xl border-2 p-3 text-sm">
                  <div className="font-extrabold">
                    {i + 1}. {q.prompt}
                  </div>
                  <ul className="mt-1.5 space-y-1">
                    {q.options.map((option, j) => (
                      <li
                        key={j}
                        className={
                          j === q.correctIndex
                            ? "font-bold text-primary"
                            : "font-semibold text-muted-foreground"
                        }
                      >
                        {String.fromCharCode(97 + j)}) {option}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && (
                    <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
                      💡 {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
