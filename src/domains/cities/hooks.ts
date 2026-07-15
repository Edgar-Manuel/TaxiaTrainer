"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchCities, fetchCityData } from "./api";

export const DEFAULT_CITY_SLUG = "santander";

export function useCities() {
  return useQuery({ queryKey: ["cities"], queryFn: fetchCities });
}

export function useCityData(slug: string = DEFAULT_CITY_SLUG) {
  return useQuery({
    queryKey: ["city-data", slug],
    queryFn: () => fetchCityData(slug),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
}
