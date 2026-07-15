import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { APP_DESCRIPTION } from "@/lib/config";
import { GAME_MODES } from "@/types/game";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-background to-accent/40">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="text-3xl">🚕</span>
          <span className="text-xl font-black tracking-tight">
            TaxiTrainer <span className="text-primary">AI</span>
          </span>
        </div>
        <Button asChild>
          <Link href="/dashboard">Entrar</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-16 text-center md:py-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight md:text-6xl">
            Domina el callejero.
            <br />
            <span className="text-primary">Aprueba el examen de taxista.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg font-semibold text-muted-foreground">
            {APP_DESCRIPTION}
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/dashboard">
                Empezar gratis <ArrowRightIcon />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/play">Ver los modos</Link>
            </Button>
          </div>
          <p className="mt-4 text-sm font-semibold text-muted-foreground">
            🗺️ Primera ciudad: Santander · Arquitectura lista para cualquier ciudad
          </p>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-3">
          {GAME_MODES.slice(0, 6).map((mode) => (
            <div
              key={mode.type}
              className="rounded-3xl border-2 bg-card p-5 shadow-sm transition-transform hover:-translate-y-1"
            >
              <div className="text-4xl">{mode.icon}</div>
              <h3 className="mt-3 text-lg font-extrabold">{mode.title}</h3>
              <p className="mt-1 text-sm font-semibold text-muted-foreground">
                {mode.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t-2 bg-card py-6 text-center text-sm font-semibold text-muted-foreground">
        TaxiTrainer AI · Datos cartográficos © OpenStreetMap
      </footer>
    </div>
  );
}
