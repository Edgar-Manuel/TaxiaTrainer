#!/usr/bin/env bash
# TaxiTrainer AI — first-run setup
set -euo pipefail
cd "$(dirname "$0")/.."

echo "🚕 TaxiTrainer AI — instalación"

if ! command -v node >/dev/null; then
  echo "❌ Necesitas Node.js 20+ (https://nodejs.org)"; exit 1
fi

echo "📦 Instalando dependencias..."
npm install

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  echo "📝 Creado .env.local — rellénalo con tus claves (Supabase, IA, MapTiler)."
  echo "   Sin claves, la app arranca en MODO DEMO con Santander de ejemplo."
fi

echo "🖼️  Generando iconos PWA..."
node scripts/generate-icons.mjs

cat <<'EOF'

✅ Listo. Próximos pasos:

  1. (Opcional) Configura Supabase:
     - Crea un proyecto en https://supabase.com
     - Ejecuta las migraciones:  supabase db push   (o pega supabase/migrations/*.sql en el SQL editor)
     - Rellena las variables en .env.local
  2. (Opcional) Importa la ciudad real desde OpenStreetMap:
     npm run import:city -- --slug santander --relation 340041
  3. Arranca en desarrollo:
     npm run dev

EOF
