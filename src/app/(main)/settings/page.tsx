"use client";

import * as Switch from "@radix-ui/react-switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isDemoMode } from "@/lib/config";
import { cn } from "@/lib/utils";
import { useProgress } from "@/stores/progress-store";
import { useSettings, type Theme } from "@/stores/settings-store";

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between py-2">
      <span className="font-bold">{label}</span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onChange}
        className={cn(
          "h-7 w-12 rounded-full border-2 transition-colors cursor-pointer",
          checked ? "border-primary bg-primary" : "border-border bg-muted",
        )}
      >
        <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-5" />
      </Switch.Root>
    </label>
  );
}

export default function SettingsPage() {
  const settings = useSettings();
  const progress = useProgress();

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-black md:text-3xl">Ajustes</h1>

      {isDemoMode && (
        <Card className="border-warning bg-warning/10">
          <CardContent className="p-4 text-sm font-semibold">
            ⚠️ Estás en <b>modo demo</b>: datos de ejemplo de Santander y progreso
            guardado en este dispositivo. Configura Supabase en <code>.env.local</code>{" "}
            e importa la ciudad real con <code>npm run import:city</code>.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Apariencia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(
              [
                ["light", "☀️ Claro"],
                ["dark", "🌙 Oscuro"],
                ["system", "💻 Sistema"],
              ] as [Theme, string][]
            ).map(([value, label]) => (
              <Button
                key={value}
                variant={settings.theme === value ? "default" : "outline"}
                size="sm"
                onClick={() => settings.setTheme(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Juego</CardTitle>
        </CardHeader>
        <CardContent>
          <Toggle checked={settings.sound} onChange={settings.setSound} label="Sonidos" />
          <Toggle
            checked={settings.voiceEnabled}
            onChange={settings.setVoiceEnabled}
            label="Voz en la IA examinadora"
          />
          <div className="flex items-center justify-between py-2">
            <span className="font-bold">Objetivo diario</span>
            <div className="flex gap-1.5">
              {[30, 50, 100, 200].map((xp) => (
                <Button
                  key={xp}
                  size="sm"
                  variant={progress.dailyGoalXp === xp ? "default" : "outline"}
                  onClick={() => progress.setDailyGoal(xp)}
                >
                  {xp}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Datos</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("¿Seguro? Se borrará todo tu progreso local.")) {
                progress.reset();
              }
            }}
          >
            Reiniciar progreso
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
