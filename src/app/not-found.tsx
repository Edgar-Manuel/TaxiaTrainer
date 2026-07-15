import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="text-7xl">🚧</span>
      <h1 className="text-4xl font-black tracking-tight">
        404 — Calle no encontrada
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Parece que esta ruta no existe en nuestro callejero. Comprueba la
        dirección o vuelve al panel de inicio.
      </p>
      <Link
        href="/dashboard"
        className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
      >
        Volver al Dashboard
      </Link>
    </div>
  );
}
