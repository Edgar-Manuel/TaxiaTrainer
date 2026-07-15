import type {
  City,
  Intersection,
  Neighborhood,
  Place,
  Street,
} from "@/types/database";

/** Everything the game engine needs about one city, loaded once and cached. */
export interface CityData {
  city: City;
  streets: Street[];
  neighborhoods: Neighborhood[];
  places: Place[];
  intersections: Intersection[];
  /** Fast lookups. */
  streetById: Map<string, Street>;
  placeById: Map<string, Place>;
  neighborhoodById: Map<string, Neighborhood>;
  /** street id -> intersecting street ids. */
  intersectionsByStreet: Map<string, Intersection[]>;
}

export function indexCityData(
  city: City,
  streets: Street[],
  neighborhoods: Neighborhood[],
  places: Place[],
  intersections: Intersection[],
): CityData {
  const intersectionsByStreet = new Map<string, Intersection[]>();
  for (const x of intersections) {
    for (const id of [x.street_a_id, x.street_b_id]) {
      const list = intersectionsByStreet.get(id) ?? [];
      list.push(x);
      intersectionsByStreet.set(id, list);
    }
  }
  return {
    city,
    streets,
    neighborhoods,
    places,
    intersections,
    streetById: new Map(streets.map((s) => [s.id, s])),
    placeById: new Map(places.map((p) => [p.id, p])),
    neighborhoodById: new Map(neighborhoods.map((n) => [n.id, n])),
    intersectionsByStreet,
  };
}
