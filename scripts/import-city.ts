/**
 * TaxiTrainer AI — OpenStreetMap city importer.
 *
 * Imports every named street (geometry, length, direction), neighborhoods,
 * intersections and important places of a city from Overpass into Supabase.
 * Fully generic: adding Madrid, Bilbao or Valencia is just another run.
 *
 * Usage:
 *   npm run import:city -- --slug santander --relation 340041
 *   npm run import:city -- --slug madrid --name "Madrid" --country ES
 *   npm run import:city -- --slug santander --relation 340041 --out src/data/demo/santander.json
 *
 * With --out the result is written to a JSON file (demo dataset) instead of Supabase.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import length from "@turf/length";
import centroid from "@turf/centroid";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import osmtogeojson from "osmtogeojson";

// ---------------------------------------------------------------------------
// Env loading (.env.local / .env) without extra dependencies
// ---------------------------------------------------------------------------

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (!existsSync(path)) continue;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
}

const OVERPASS_URL =
  process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

const slug = arg("slug");
const relationArg = arg("relation");
const cityName = arg("name");
const country = arg("country") ?? "ES";
const outFile = arg("out");

if (!slug) {
  console.error(
    "Uso: npm run import:city -- --slug <slug> [--relation <osmRelId>] [--name <nombre>] [--country ES] [--out fichero.json]",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(calle|avenida|paseo|plaza|c\/|avda\.?|po\.?)\b/g, "")
    .replace(/[^a-z0-9ñ\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function overpass(query: string): Promise<OverpassResponse> {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (res.status === 429 || res.status === 504) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
      return (await res.json()) as OverpassResponse;
    } catch (err) {
      if (attempt === 4) throw err;
      const wait = 2 ** attempt * 2000;
      console.log(`  Overpass falló (${err}), reintentando en ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  nodes?: number[];
  tags?: Record<string, string>;
  members?: unknown[];
  geometry?: { lat: number; lon: number }[];
}

interface OverpassResponse {
  elements: OverpassElement[];
}

async function resolveRelationId(): Promise<number> {
  if (relationArg) return Number(relationArg);
  if (!cityName) {
    console.error("Se necesita --relation <id> o --name <nombre de ciudad>");
    process.exit(1);
  }
  console.log(`Buscando "${cityName}" (${country}) en Nominatim...`);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    cityName,
  )}&countrycodes=${country.toLowerCase()}&featureType=city&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "TaxiTrainerAI/1.0 (importer)" },
  });
  const results = (await res.json()) as { osm_type: string; osm_id: number }[];
  const rel = results.find((r) => r.osm_type === "relation");
  if (!rel) throw new Error(`No se encontró la relación OSM para ${cityName}`);
  return rel.osm_id;
}

// ---------------------------------------------------------------------------
// Output shapes (shared with the app's demo loader)
// ---------------------------------------------------------------------------

interface ImportedStreet {
  name: string;
  normalized_name: string;
  osm_way_ids: number[];
  highway_type: string;
  oneway: boolean;
  length_m: number;
  geojson: GeoJSON.MultiLineString;
  centroid: [number, number];
  neighborhood?: string;
}

interface ImportedNeighborhood {
  name: string;
  osm_id: number | null;
  geojson: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  centroid: [number, number];
}

interface ImportedPlace {
  name: string;
  category: string;
  osm_id: number;
  point: [number, number];
  neighborhood?: string;
}

interface ImportedIntersection {
  a: string; // normalized street name
  b: string;
  point: [number, number];
}

// ---------------------------------------------------------------------------
// Street import: named highways, grouped by name, with shared-node
// intersection detection.
// ---------------------------------------------------------------------------

const HIGHWAY_FILTER =
  "^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian)(_link)?$";

async function importStreets(areaId: number): Promise<{
  streets: ImportedStreet[];
  intersections: ImportedIntersection[];
}> {
  console.log("Descargando calles desde Overpass...");
  const data = await overpass(`
    [out:json][timeout:300];
    area(${areaId})->.a;
    way(area.a)["highway"~"${HIGHWAY_FILTER}"]["name"];
    out body;
    >;
    out skel qt;
  `);

  const nodes = new Map<number, [number, number]>();
  const ways: OverpassElement[] = [];
  for (const el of data.elements) {
    if (el.type === "node" && el.lat !== undefined && el.lon !== undefined) {
      nodes.set(el.id, [el.lon, el.lat]);
    } else if (el.type === "way" && el.tags?.name && el.nodes) {
      ways.push(el);
    }
  }
  console.log(`  ${ways.length} tramos, ${nodes.size} nodos`);

  // Group ways by normalized street name.
  const byStreet = new Map<string, { name: string; ways: OverpassElement[] }>();
  for (const way of ways) {
    const key = normalizeName(way.tags!.name);
    if (!key) continue;
    const entry = byStreet.get(key) ?? { name: way.tags!.name, ways: [] };
    entry.ways.push(way);
    byStreet.set(key, entry);
  }

  const streets: ImportedStreet[] = [];
  for (const [normalized, { name, ways: streetWays }] of byStreet) {
    const lines: [number, number][][] = [];
    for (const way of streetWays) {
      const coords = way.nodes!.map((id) => nodes.get(id)).filter(Boolean) as [
        number,
        number,
      ][];
      if (coords.length >= 2) lines.push(coords);
    }
    if (lines.length === 0) continue;

    const geojson: GeoJSON.MultiLineString = {
      type: "MultiLineString",
      coordinates: lines,
    };
    const feature: GeoJSON.Feature = { type: "Feature", properties: {}, geometry: geojson };
    const lengthM = Math.round(length(feature, { units: "kilometers" }) * 1000);
    const center = centroid(feature).geometry.coordinates as [number, number];

    streets.push({
      name,
      normalized_name: normalized,
      osm_way_ids: streetWays.map((w) => w.id),
      highway_type: streetWays[0].tags!.highway,
      oneway: streetWays.every((w) => w.tags?.oneway === "yes"),
      length_m: lengthM,
      geojson,
      centroid: center,
    });
  }
  console.log(`  ${streets.length} calles únicas`);

  // Intersections: OSM nodes shared by ways of two different streets.
  console.log("Calculando cruces...");
  const nodeStreets = new Map<number, Set<string>>();
  for (const way of ways) {
    const key = normalizeName(way.tags!.name);
    if (!key) continue;
    for (const nodeId of way.nodes!) {
      let set = nodeStreets.get(nodeId);
      if (!set) nodeStreets.set(nodeId, (set = new Set()));
      set.add(key);
    }
  }

  const seen = new Set<string>();
  const intersections: ImportedIntersection[] = [];
  for (const [nodeId, streetSet] of nodeStreets) {
    if (streetSet.size < 2) continue;
    const list = [...streetSet].sort();
    const point = nodes.get(nodeId);
    if (!point) continue;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const pairKey = `${list[i]}|${list[j]}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);
        intersections.push({ a: list[i], b: list[j], point });
      }
    }
  }
  console.log(`  ${intersections.length} cruces`);

  return { streets, intersections };
}

// ---------------------------------------------------------------------------
// Neighborhoods: administrative boundaries level 9-10 + place polygons
// ---------------------------------------------------------------------------

async function importNeighborhoods(areaId: number): Promise<ImportedNeighborhood[]> {
  console.log("Descargando barrios...");
  const data = await overpass(`
    [out:json][timeout:180];
    area(${areaId})->.a;
    (
      relation(area.a)["boundary"="administrative"]["admin_level"~"^(9|10)$"]["name"];
      way(area.a)["place"~"^(suburb|neighbourhood|quarter)$"]["name"];
      relation(area.a)["place"~"^(suburb|neighbourhood|quarter)$"]["name"];
    );
    out geom;
  `);

  const collection = osmtogeojson(data) as GeoJSON.FeatureCollection;
  const result: ImportedNeighborhood[] = [];
  const seenNames = new Set<string>();

  for (const feature of collection.features) {
    const name = (feature.properties as Record<string, string>)?.name;
    const geom = feature.geometry;
    if (!name || !geom) continue;
    if (geom.type !== "Polygon" && geom.type !== "MultiPolygon") continue;
    const key = normalizeName(name);
    if (seenNames.has(key)) continue;
    seenNames.add(key);
    const center = centroid(feature).geometry.coordinates as [number, number];
    const osmId = Number(String(feature.id ?? "").replace(/\D/g, "")) || null;
    result.push({ name, osm_id: osmId, geojson: geom, centroid: center });
  }
  console.log(`  ${result.length} barrios`);
  return result;
}

// ---------------------------------------------------------------------------
// Places: hospitals, hotels, beaches, stations, monuments...
// ---------------------------------------------------------------------------

const CATEGORY_RULES: [key: string, pattern: RegExp, category: string][] = [
  ["amenity", /^hospital|clinic$/, "hospital"],
  ["amenity", /^police$/, "police"],
  ["amenity", /^fire_station$/, "fire_station"],
  ["amenity", /^courthouse$/, "court"],
  ["amenity", /^marketplace$/, "market"],
  ["amenity", /^bus_station$/, "station"],
  ["amenity", /^university|college$/, "university"],
  ["amenity", /^townhall$/, "official_building"],
  ["railway", /^station$/, "station"],
  ["tourism", /^hotel$/, "hotel"],
  ["tourism", /^museum|attraction$/, "monument"],
  ["historic", /^monument|memorial|castle|church|cathedral$/, "monument"],
  ["natural", /^beach$/, "beach"],
  ["leisure", /^park$/, "park"],
  ["shop", /^mall|department_store$/, "mall"],
  ["building", /^government$/, "official_building"],
  ["office", /^government$/, "official_building"],
];

function categorize(tags: Record<string, string>): string | null {
  for (const [key, pattern, category] of CATEGORY_RULES) {
    if (tags[key] && pattern.test(tags[key])) return category;
  }
  return null;
}

async function importPlaces(areaId: number): Promise<ImportedPlace[]> {
  console.log("Descargando lugares importantes...");
  const data = await overpass(`
    [out:json][timeout:180];
    area(${areaId})->.a;
    (
      nwr(area.a)["amenity"~"^(hospital|clinic|police|fire_station|courthouse|marketplace|bus_station|university|college|townhall)$"]["name"];
      nwr(area.a)["railway"="station"]["name"];
      nwr(area.a)["tourism"~"^(hotel|museum|attraction)$"]["name"];
      nwr(area.a)["historic"~"^(monument|memorial|castle)$"]["name"];
      nwr(area.a)["natural"="beach"]["name"];
      nwr(area.a)["leisure"="park"]["name"];
      nwr(area.a)["shop"~"^(mall|department_store)$"]["name"];
      nwr(area.a)["building"="government"]["name"];
      nwr(area.a)["office"="government"]["name"];
    );
    out center;
  `);

  const places: ImportedPlace[] = [];
  const seen = new Set<string>();
  for (const el of data.elements) {
    const tags = el.tags ?? {};
    const name = tags.name;
    if (!name) continue;
    const category = categorize(tags);
    if (!category) continue;
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat === undefined || lon === undefined) continue;
    const dedupeKey = `${category}:${normalizeName(name)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    places.push({ name, category, osm_id: el.id, point: [lon, lat] });
  }
  console.log(`  ${places.length} lugares`);
  return places;
}

// ---------------------------------------------------------------------------
// Neighborhood assignment
// ---------------------------------------------------------------------------

function assignNeighborhoods(
  streets: ImportedStreet[],
  places: ImportedPlace[],
  neighborhoods: ImportedNeighborhood[],
) {
  if (neighborhoods.length === 0) return;
  const polys = neighborhoods.map((n) => ({
    name: n.name,
    feature: {
      type: "Feature",
      properties: {},
      geometry: n.geojson,
    } as GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon>,
  }));

  const findNeighborhood = (point: [number, number]): string | undefined =>
    polys.find((p) => booleanPointInPolygon(point, p.feature))?.name;

  for (const street of streets) street.neighborhood = findNeighborhood(street.centroid);
  for (const place of places) place.neighborhood = findNeighborhood(place.point);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

async function saveToSupabase(
  relationId: number,
  streets: ImportedStreet[],
  neighborhoods: ImportedNeighborhood[],
  places: ImportedPlace[],
  intersections: ImportedIntersection[],
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (usa --out para generar un fichero)",
    );
    process.exit(1);
  }
  const db: SupabaseClient = createClient(url, key, {
    auth: { persistSession: false },
  });

  // Bounding box from street geometry.
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const s of streets) {
    for (const line of s.geojson.coordinates) {
      for (const [lng, lat] of line) {
        minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
      }
    }
  }

  console.log("Guardando ciudad...");
  const { data: city, error: cityError } = await db
    .from("cities")
    .upsert(
      {
        slug,
        name: cityName ?? slug!.charAt(0).toUpperCase() + slug!.slice(1),
        country,
        center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2],
        bbox: [minLng, minLat, maxLng, maxLat],
        osm_relation_id: relationId,
        status: "importing",
        published: true,
      },
      { onConflict: "slug" },
    )
    .select()
    .single();
  if (cityError) throw cityError;
  const cityId = city.id as string;

  console.log("Guardando barrios...");
  const neighborhoodIds = new Map<string, string>();
  for (const n of neighborhoods) {
    const { data, error } = await db
      .from("neighborhoods")
      .upsert(
        {
          city_id: cityId,
          name: n.name,
          osm_id: n.osm_id,
          geojson: n.geojson,
          centroid: n.centroid,
        },
        { onConflict: "city_id,name" },
      )
      .select("id,name")
      .single();
    if (error) throw error;
    neighborhoodIds.set(normalizeName(data.name), data.id);
  }

  console.log("Guardando calles...");
  const streetIds = new Map<string, string>();
  const BATCH = 200;
  for (let i = 0; i < streets.length; i += BATCH) {
    const batch = streets.slice(i, i + BATCH).map((s) => ({
      city_id: cityId,
      neighborhood_id: s.neighborhood
        ? (neighborhoodIds.get(normalizeName(s.neighborhood)) ?? null)
        : null,
      name: s.name,
      normalized_name: s.normalized_name,
      osm_way_ids: s.osm_way_ids,
      highway_type: s.highway_type,
      oneway: s.oneway,
      length_m: s.length_m,
      geojson: s.geojson,
      centroid: s.centroid,
    }));
    const { data, error } = await db
      .from("streets")
      .upsert(batch, { onConflict: "city_id,normalized_name" })
      .select("id,normalized_name");
    if (error) throw error;
    for (const row of data) streetIds.set(row.normalized_name, row.id);
    console.log(`  ${Math.min(i + BATCH, streets.length)}/${streets.length}`);
  }

  console.log("Guardando lugares...");
  for (let i = 0; i < places.length; i += BATCH) {
    const batch = places.slice(i, i + BATCH).map((p) => ({
      city_id: cityId,
      neighborhood_id: p.neighborhood
        ? (neighborhoodIds.get(normalizeName(p.neighborhood)) ?? null)
        : null,
      category: p.category,
      name: p.name,
      osm_id: p.osm_id,
      point: p.point,
    }));
    const { error } = await db
      .from("places")
      .upsert(batch, { onConflict: "city_id,category,name" });
    if (error) throw error;
  }

  console.log("Guardando cruces...");
  const rows = intersections
    .map((x) => ({
      city_id: cityId,
      street_a_id: streetIds.get(x.a),
      street_b_id: streetIds.get(x.b),
      point: x.point,
    }))
    .filter((r) => r.street_a_id && r.street_b_id);
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db
      .from("intersections")
      .upsert(rows.slice(i, i + BATCH), { onConflict: "street_a_id,street_b_id" });
    if (error) throw error;
    console.log(`  ${Math.min(i + BATCH, rows.length)}/${rows.length}`);
  }

  await db
    .from("cities")
    .update({
      status: "ready",
      streets_count: streets.length,
      places_count: places.length,
    })
    .eq("id", cityId);

  console.log(`\n✅ ${slug}: ${streets.length} calles, ${neighborhoods.length} barrios, ${places.length} lugares, ${rows.length} cruces`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const relationId = await resolveRelationId();
  const areaId = 3_600_000_000 + relationId;
  console.log(`Importando "${slug}" (relación OSM ${relationId})\n`);

  const [{ streets, intersections }, neighborhoods, places] = [
    await importStreets(areaId),
    await importNeighborhoods(areaId),
    await importPlaces(areaId),
  ];

  assignNeighborhoods(streets, places, neighborhoods);

  if (outFile) {
    const payload = {
      slug,
      name: cityName ?? slug,
      country,
      osm_relation_id: relationId,
      generated_at: new Date().toISOString(),
      streets,
      neighborhoods,
      places,
      intersections,
    };
    writeFileSync(resolve(process.cwd(), outFile), JSON.stringify(payload));
    console.log(`\n✅ Dataset escrito en ${outFile}`);
    return;
  }

  await saveToSupabase(relationId, streets, neighborhoods, places, intersections);
}

main().catch((err) => {
  console.error("\n❌ Error en la importación:", err);
  process.exit(1);
});
