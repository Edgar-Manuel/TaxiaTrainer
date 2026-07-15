# 🚕 TaxiTrainer AI

**El Duolingo del callejero.** Aplicación web para preparar el examen oficial del
permiso municipal de taxista de cualquier ciudad española — empezando por
Santander — con mapas interactivos, gamificación, repetición espaciada e IA.

## ✨ Características

- **13 modos de entrenamiento**: encuentra la calle, ¿qué calle es?, completa el
  recorrido, memoria visual, barrios, lugares importantes, cruces, calles
  cercanas, paralelas, desembocaduras, ruta más rápida con calles cortadas,
  IA examinadora por voz y examen oficial cronometrado con informe final.
- **Mapa interactivo MapLibre GL**: modos claro/oscuro/satélite/sin nombres,
  resaltado y animación de calles, flechas de sentido, mapa de calor de errores
  y mapa coloreado por dominio (rojo → amarillo → verde).
- **Repetición espaciada (SM-2, tipo Anki)** por calle, lugar y barrio: lo que
  fallas vuelve antes; lo que dominas espacia sus repasos.
- **Gamificación completa**: XP, niveles, rachas, logros, objetivo diario,
  porcentaje de ciudad dominada, confeti, sonidos y microinteracciones.
- **Estadísticas**: horas de estudio, precisión por tipo de pregunta, XP por
  día, dominio por barrio, errores más frecuentes.
- **IA con proveedor intercambiable** (cualquier API compatible con OpenAI):
  examinadora conversacional por voz, explicación de errores y generación de
  preguntas de callejero y reglamento.
- **Importador automático de OpenStreetMap**: calles con geometría, longitud y
  sentido, barrios, cruces y lugares (hospitales, hoteles, playas, estaciones,
  universidades, monumentos, centros comerciales, comisarías, bomberos,
  juzgados, mercados, parques...).
- **Multiciudad de serie**: nada en el código es específico de Santander;
  añadir Madrid, Bilbao o Valencia es ejecutar un comando.
- **PWA instalable** con caché offline de la aplicación y de teselas de mapa.

## 🚀 Arranque rápido (modo demo, sin configurar nada)

```bash
./scripts/setup.sh   # o: npm install
npm run dev
```

Abre <http://localhost:3000>. Sin credenciales de Supabase la app arranca en
**modo demo**: un dataset de ejemplo de Santander (geometrías aproximadas) y el
progreso guardado en el navegador. Perfecto para probar la experiencia.

## 🗄️ Producción con Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Aplica las migraciones de `supabase/migrations/` (SQL editor o `supabase db push`).
   Crean todo el esquema: usuarios, ciudades, barrios, calles, cruces, lugares,
   preguntas, sesiones, respuestas, SRS, logros, favoritos, colecciones, rutas,
   estadísticas y políticas RLS.
3. Copia `.env.example` a `.env.local` y rellena:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # solo para el importador y administración
```

4. Importa la ciudad real desde OpenStreetMap:

```bash
npm run import:city -- --slug santander --relation 340041
```

## 🌍 Añadir más ciudades

No hay que tocar código, solo importar datos:

```bash
npm run import:city -- --slug madrid --name "Madrid"
npm run import:city -- --slug bilbao --name "Bilbao"
npm run import:city -- --slug valencia --name "Valencia"
```

El importador resuelve la relación OSM vía Nominatim (o acepta `--relation <id>`
explícito), descarga calles/barrios/lugares de Overpass, agrupa tramos por
nombre, calcula cruces por nodos compartidos, asigna barrios por
punto-en-polígono y lo guarda todo en Supabase. Con `--out fichero.json` genera
un dataset local en lugar de escribir en la base de datos.

## 🤖 Configurar la IA

Cualquier endpoint compatible con la API de OpenAI (OpenRouter, OpenAI directo, DeepSeek, etc.):

```bash
AI_API_KEY=sk-or-...
AI_MODEL=google/gemini-2.5-flash
AI_BASE_URL=https://openrouter.ai/api/v1

# O otras alternativas:
# AI_API_KEY=sk-...
# AI_MODEL=gpt-4o-mini
# AI_BASE_URL=https://api.openai.com/v1
# AI_BASE_URL=https://api.deepseek.com/v1       # DeepSeek
# AI_BASE_URL=http://localhost:11434/v1       # Ollama local
```

Activa: IA examinadora por voz (`/examiner`), botón «¿Por qué?» al fallar y el
generador de preguntas del panel de administración.

## 🗺️ Mapas

Por defecto se usan teselas gratuitas (OpenStreetMap, CARTO para modo
oscuro/sin nombres, Esri para satélite). Con una clave gratuita de
[MapTiler](https://maptiler.com) (`NEXT_PUBLIC_MAPTILER_KEY`) se activan estilos
vectoriales premium.

## 🐳 Docker

```bash
cp .env.example .env   # rellena las variables
docker compose up --build
```

## 📦 Scripts

| Comando | Descripción |
|---|---|
| `npm run dev` | Desarrollo con Turbopack |
| `npm run build` / `npm start` | Producción |
| `npm run lint` / `npm run typecheck` | Calidad |
| `npm run import:city` | Importador OSM → Supabase |
| `node scripts/generate-icons.mjs` | Regenerar iconos PWA |

## 🧭 Estructura

```
src/
├── app/            # Rutas (App Router): landing, (main)/dashboard|play|exam|
│                   # examiner|map|stats|achievements|settings|admin, api/ai/*
├── components/     # ui/ (estilo shadcn), map/ (MapLibre), game/, layout/
├── domains/        # Lógica por dominio: cities, game, srs, gamification, ai
├── stores/         # Zustand: progreso (SRS+XP), sesión de juego, ajustes
├── lib/            # config, supabase, sonido, voz, utilidades
├── types/          # Tipos de BD, juego y geometría
└── data/demo/      # Dataset demo de Santander (modo sin credenciales)
supabase/migrations # Esquema completo + seed
scripts/            # import-city.ts, generate-icons.mjs, setup.sh
```

Más detalle en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) y
[`docs/DATABASE.md`](docs/DATABASE.md).

## 📄 Licencia y datos

Datos cartográficos © colaboradores de
[OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
