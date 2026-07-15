# Base de datos (Supabase / PostgreSQL + PostGIS)

Migraciones en `supabase/migrations/`. Todas las tablas tienen RLS activado.

## Catálogo geográfico (público en lectura, escritura solo admin)

| Tabla | Contenido |
|---|---|
| `cities` | slug, nombre, centro, bbox, relación OSM, estado, contadores |
| `neighborhoods` | barrios con polígono GeoJSON + geometría PostGIS sincronizada por trigger |
| `streets` | calles agrupadas por nombre: MultiLineString, longitud, sentido único, tipo de vía, barrio, alias; única por `(city_id, normalized_name)` |
| `intersections` | pares de calles que se cruzan + punto del cruce |
| `places` | lugares categorizados (enum `place_category`: hospital, hotel, playa, edificio oficial, estación, universidad, monumento, centro comercial, comisaría, bomberos, juzgado, mercado, parque, plaza) |
| `questions` | banco opcional de preguntas pregeneradas o creadas por IA |

Los triggers `sync_geom_from_geojson` mantienen columnas `geometry` PostGIS a
partir del GeoJSON que consume la app, habilitando índices GiST y consultas
espaciales en SQL.

## Usuarios y progreso (propiedad estricta por RLS)

| Tabla | Contenido |
|---|---|
| `profiles` | extiende `auth.users`: rol, XP, nivel, racha actual/mejor, objetivo diario, ciudad activa; creada por trigger al registrarse |
| `sessions` | cada partida/examen: modo, puntuación, XP, duración |
| `answers` | cada respuesta: tipo, objetivo, acierto, distancia, tiempo y **ubicación** (alimenta el mapa de calor de errores) |
| `mastery` | estado SM-2 por `(user, target_type, target_id)`: repeticiones, facilidad, intervalo, vencimiento, dominio 0-100, fallos |
| `study_days` | agregado diario (XP, tiempo, aciertos) para rachas y gráficas |
| `achievements` / `user_achievements` | catálogo (seed incluido) y desbloqueos |
| `favorites`, `collections`, `collection_items` | marcado y agrupación de calles/lugares |
| `routes` | rutas guardadas (globales o del usuario) |

## Funciones y vistas

- `apply_session_result(city, xp, tiempo, respuestas, aciertos)` — RPC atómica
  que actualiza XP, nivel, racha y el agregado diario.
- `is_admin()` — usada por las políticas de escritura del catálogo.
- `leaderboard` — top 100 por XP.
- `error_heatmap` — puntos de respuestas falladas por ciudad.

## Importador

`scripts/import-city.ts` hace *upsert* idempotente (re-ejecutar actualiza el
callejero sin duplicar) por lotes de 200 filas y marca la ciudad `ready` con
contadores al terminar.
