"use client";

import { isDemoMode } from "@/lib/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { santanderDemo } from "@/data/demo/santander";
import { buildDemoCity } from "./demo";
import { indexCityData, type CityData } from "./types";
import type {
  City,
  Intersection,
  Neighborhood,
  Place,
  Street,
} from "@/types/database";

const demoCities: Record<string, CityData> = {};

function getDemoCity(slug: string): CityData {
  if (!demoCities[slug]) {
    if (slug !== "santander") {
      throw new Error(`En modo demo solo está disponible Santander (pedido: ${slug})`);
    }
    demoCities[slug] = buildDemoCity(santanderDemo);
  }
  return demoCities[slug];
}

export async function fetchCities(): Promise<City[]> {
  if (isDemoMode) return [getDemoCity("santander").city];
  const db = getSupabaseBrowser()!;
  const { data, error } = await db
    .from("cities")
    .select("*")
    .eq("published", true)
    .order("name");
  if (error) throw error;
  return data as City[];
}

export async function fetchCityData(slug: string): Promise<CityData> {
  if (isDemoMode) return getDemoCity(slug);

  const db = getSupabaseBrowser()!;
  const { data: city, error: cityError } = await db
    .from("cities")
    .select("*")
    .eq("slug", slug)
    .single();
  if (cityError) throw cityError;

  const [streets, neighborhoods, places, intersections] = await Promise.all([
    fetchAll<Street>("streets", city.id),
    fetchAll<Neighborhood>("neighborhoods", city.id),
    fetchAll<Place>("places", city.id),
    fetchAll<Intersection>("intersections", city.id),
  ]);

  return indexCityData(city as City, streets, neighborhoods, places, intersections);
}

/** Pages through a city-scoped table (Supabase caps selects at 1000 rows). */
async function fetchAll<T>(table: string, cityId: string): Promise<T[]> {
  const db = getSupabaseBrowser()!;
  const PAGE = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .eq("city_id", cityId)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}
