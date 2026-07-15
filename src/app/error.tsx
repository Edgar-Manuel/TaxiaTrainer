"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-8 text-center">
      <span className="text-7xl">🛑</span>
      <h1 className="text-4xl font-black tracking-tight">
        Algo ha fallado
      </h1>
      <p className="max-w-md text-lg text-muted-foreground">
        Ha ocurrido un error inesperado. Puedes intentar recargar la página o
        volver a empezar.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Reintentar
        </button>
        <a
          href="/dashboard"
          className="rounded-2xl border-2 px-6 py-3 text-sm font-bold transition-transform hover:scale-105 active:scale-95"
        >
          Ir al Dashboard
        </a>
      </div>
    </div>
  );
}
