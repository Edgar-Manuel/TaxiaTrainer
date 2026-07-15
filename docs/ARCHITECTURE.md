# Arquitectura

## Principios

1. **Genérico por ciudad.** Ninguna lógica menciona Santander: todo opera sobre
   `CityData` (calles, barrios, lugares, cruces indexados). Añadir una ciudad es
   añadir datos.
2. **Separación por dominios.** `src/domains/*` contiene la lógica de negocio
   pura (generación de preguntas, geometría, SRS, gamificación, IA); los
   componentes de `src/components` solo renderizan.
3. **Funciona sin backend.** Con Supabase sin configurar, la capa de datos
   (`domains/cities/api.ts`) sirve el dataset demo y el progreso vive en
   `localStorage` (stores persistidos de Zustand). La interfaz es idéntica.

## Flujo de una sesión de juego

```
useCityData(slug) ──> CityData (React Query, cache infinita)
        │
GameSession.startSession()
        │  preferredTargets = calles pendientes/débiles según SM-2
        ▼
domains/game/generator.ts ──> Question[] (autocontenidas: prompt+geometrías+opciones)
        │
Vistas por tipo (clic en mapa / opciones / ruta / memoria)
        │  scoring.ts (distancias turf, cobertura de ruta...)
        ▼
progress-store.recordAnswer()  ──> SM-2 review() por objetivo
game-store feedback ──> siguiente pregunta
        │
progress-store.completeSession() ──> XP, racha, día de estudio
gamification/achievements.checkAchievements() ──> logros + confeti + toast
```

## Generación de preguntas

- **Geométricas** (`domains/game/geo.ts`): cruces desde la tabla de
  intersecciones, paralelas por rumbo dominante + distancia, desembocaduras por
  contacto de extremos, cercanas por distancia entre centroides.
- **Rutas**: grafo de intersecciones por calle + Dijkstra
  (`buildRouteGraph`/`shortestRoute`). La «ruta más rápida» corta una calle de
  la ruta óptima y recalcula el desvío. La respuesta del usuario se evalúa por
  **cobertura**: % de la ruta de referencia a menos de 100 m del trazo dibujado.
- **SRS**: el generador prioriza (70 %) objetivos que la repetición espaciada
  marca como pendientes o débiles.

## Mapa

`components/map/CityMap.tsx` encapsula MapLibre: capas de resaltado
(línea/relleno/flechas/pulso animado), marcadores, heatmap y fitBounds
declarativos vía props. Los estilos (`styles.ts`) resuelven
claro/oscuro/satélite/sin nombres con teselas libres o MapTiler.

## IA

`domains/ai/provider.ts` expone `chat()` sobre cualquier endpoint compatible con
OpenAI (`AI_BASE_URL`+`AI_MODEL`+`AI_API_KEY`). Las rutas de API
(`app/api/ai/*`) son las únicas que tocan la clave; el cliente consume
`domains/ai/client.ts`. El contexto del examinador (ruta óptima calle a calle)
se calcula **localmente** con el grafo y se envía como texto, así el modelo
corrige con datos reales y no alucina calles.

## Sincronización con Supabase

Los stores locales son la fuente de verdad inmediata (optimista, offline-first).
Con Supabase configurado, el esquema completo (sessions, answers, mastery,
study_days + RPC `apply_session_result`) está listo para write-through; la capa
de catálogo (ciudades/calles/lugares) ya lee de Supabase con paginación.
