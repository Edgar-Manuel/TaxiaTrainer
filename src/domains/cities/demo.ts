/**
 * Builds a full CityData from a compact hand-authored dataset.
 * Lengths, centroids, intersections and neighborhood assignment are
 * computed with turf, mirroring what the OSM importer does server-side.
 */

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import centroid from "@turf/centroid";
import lineIntersect from "@turf/line-intersect";
import length from "@turf/length";
import { normalizeName } from "@/lib/utils";
import type {
  City,
  Intersection,
  Neighborhood,
  Place,
  PlaceCategory,
  Street,
} from "@/types/database";
import type { LngLat } from "@/types/geo";
import { indexCityData, type CityData } from "./types";

export interface RawCityData {
  slug: string;
  name: string;
  country: string;
  center: LngLat;
  bbox: [number, number, number, number];
  streets: {
    name: string;
    type: string;
    oneway: boolean;
    line: LngLat[];
  }[];
  neighborhoods: { name: string; polygon: LngLat[] }[];
  places: { name: string; category: string; point: LngLat }[];
}

export function buildDemoCity(raw: RawCityData): CityData {
  const cityId = `demo-${raw.slug}`;
  const city: City = {
    id: cityId,
    slug: raw.slug,
    name: raw.name,
    country: raw.country,
    center: raw.center,
    bbox: raw.bbox,
    osm_relation_id: null,
    status: "ready",
    streets_count: raw.streets.length,
    places_count: raw.places.length,
    published: true,
    created_at: new Date().toISOString(),
  };

  const neighborhoods: Neighborhood[] = raw.neighborhoods.map((n) => {
    const ring = [...n.polygon, n.polygon[0]];
    const geojson = { type: "Polygon" as const, coordinates: [ring] };
    return {
      id: `${cityId}-nb-${normalizeName(n.name)}`.replace(/\s/g, "-"),
      city_id: cityId,
      name: n.name,
      osm_id: null,
      geojson,
      centroid: centroid(geojson).geometry.coordinates as LngLat,
    };
  });

  const findNeighborhood = (point: LngLat): string | null =>
    neighborhoods.find((n) =>
      booleanPointInPolygon(point, {
        type: "Feature",
        properties: {},
        geometry: n.geojson,
      }),
    )?.id ?? null;

  const streets: Street[] = raw.streets.map((s) => {
    const geojson = { type: "LineString" as const, coordinates: s.line };
    const center = centroid(geojson).geometry.coordinates as LngLat;
    return {
      id: `${cityId}-st-${normalizeName(s.name)}`.replace(/\s/g, "-"),
      city_id: cityId,
      neighborhood_id: findNeighborhood(center),
      name: s.name,
      normalized_name: normalizeName(s.name),
      osm_way_ids: [],
      highway_type: s.type,
      oneway: s.oneway,
      length_m: Math.round(length({ type: "Feature", properties: {}, geometry: geojson }, { units: "kilometers" }) * 1000),
      geojson,
      centroid: center,
      aliases: [],
    };
  });

  const intersections: Intersection[] = [];
  for (let i = 0; i < streets.length; i++) {
    for (let j = i + 1; j < streets.length; j++) {
      const points = lineIntersect(
        { type: "Feature", properties: {}, geometry: streets[i].geojson },
        { type: "Feature", properties: {}, geometry: streets[j].geojson },
        { ignoreSelfIntersections: true },
      );
      const first = points.features[0];
      if (!first) continue;
      intersections.push({
        id: `${cityId}-x-${i}-${j}`,
        city_id: cityId,
        street_a_id: streets[i].id,
        street_b_id: streets[j].id,
        point: first.geometry.coordinates as LngLat,
      });
    }
  }

  const places: Place[] = raw.places.map((p, idx) => ({
    id: `${cityId}-pl-${idx}-${normalizeName(p.name)}`.replace(/\s/g, "-"),
    city_id: cityId,
    neighborhood_id: findNeighborhood(p.point),
    category: p.category as PlaceCategory,
    name: p.name,
    osm_id: null,
    point: p.point,
    address: null,
    tags: {},
  }));

  return indexCityData(city, streets, neighborhoods, places, intersections);
}
