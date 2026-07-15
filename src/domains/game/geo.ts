import bearing from "@turf/bearing";
import distance from "@turf/distance";
import nearestPointOnLine from "@turf/nearest-point-on-line";
import pointToLineDistance from "@turf/point-to-line-distance";
import type { CityData } from "@/domains/cities/types";
import type { Street } from "@/types/database";
import type { LngLat, StreetGeometry } from "@/types/geo";

function lines(geometry: StreetGeometry): LngLat[][] {
  return geometry.type === "LineString"
    ? [geometry.coordinates]
    : geometry.coordinates;
}

/** Meters from a point to the closest segment of a street. */
export function distanceToStreet(point: LngLat, street: Street): number {
  let min = Infinity;
  for (const line of lines(street.geojson)) {
    const d = pointToLineDistance(point, { type: "LineString", coordinates: line }, {
      units: "kilometers",
    });
    min = Math.min(min, d * 1000);
  }
  return min;
}

export function nearestStreet(
  point: LngLat,
  streets: Street[],
): { street: Street; distanceM: number } | null {
  let best: { street: Street; distanceM: number } | null = null;
  for (const street of streets) {
    const d = distanceToStreet(point, street);
    if (!best || d < best.distanceM) best = { street, distanceM: d };
  }
  return best;
}

export function centroidDistanceM(a: Street, b: Street): number {
  return distance(a.centroid, b.centroid, { units: "kilometers" }) * 1000;
}

/** Dominant bearing (0-180°) of the street's longest segment run. */
export function streetBearing(street: Street): number {
  const all = lines(street.geojson);
  const longest = all.reduce((acc, l) => (l.length > acc.length ? l : acc), all[0]);
  const raw = bearing(longest[0], longest[longest.length - 1]);
  return ((raw % 180) + 180) % 180;
}

export function bearingDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

function intersects(city: CityData, a: Street, b: Street): boolean {
  return (
    city.intersectionsByStreet
      .get(a.id)
      ?.some((x) => x.street_a_id === b.id || x.street_b_id === b.id) ?? false
  );
}

export function areParallel(city: CityData, a: Street, b: Street): boolean {
  if (a.id === b.id || intersects(city, a, b)) return false;
  return (
    bearingDiff(streetBearing(a), streetBearing(b)) < 25 &&
    centroidDistanceM(a, b) < 800
  );
}

export function endpointsOf(street: Street): LngLat[] {
  return lines(street.geojson).flatMap((l) => [l[0], l[l.length - 1]]);
}

/** True when `a` ends on `b` (an endpoint of `a` touches `b`'s geometry). */
export function flowsInto(a: Street, b: Street): boolean {
  if (a.id === b.id) return false;
  return endpointsOf(a).some((p) => distanceToStreet(p, b) < 40);
}

// ---------------------------------------------------------------------------
// Routing graph (Dijkstra over the intersection network)
// ---------------------------------------------------------------------------

interface GraphNode {
  id: string;
  point: LngLat;
}

interface GraphEdge {
  to: string;
  weightM: number;
  streetId: string;
}

export interface RouteGraph {
  nodes: Map<string, GraphNode>;
  edges: Map<string, GraphEdge[]>;
}

/** Grid size (~30 m) used to merge nearby points into one graph node. */
const CLUSTER_DEG = 0.0003;

/**
 * Builds a routable graph. Nodes are intersections AND street endpoints,
 * clustered by proximity so streets that touch end-to-end connect; edges
 * link consecutive nodes along each street line.
 */
export function buildRouteGraph(city: CityData): RouteGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge[]>();

  const nodeIdFor = (point: LngLat): string => {
    const id = `${Math.round(point[0] / CLUSTER_DEG)}:${Math.round(point[1] / CLUSTER_DEG)}`;
    if (!nodes.has(id)) nodes.set(id, { id, point });
    return id;
  };

  // Register every candidate junction point.
  for (const x of city.intersections) nodeIdFor(x.point);
  for (const street of city.streets) {
    for (const line of lines(street.geojson)) {
      nodeIdFor(line[0]);
      nodeIdFor(line[line.length - 1]);
    }
  }

  const addEdge = (from: string, to: string, weightM: number, streetId: string) => {
    if (from === to) return;
    const list = edges.get(from) ?? [];
    list.push({ to, weightM, streetId });
    edges.set(from, list);
  };

  // Connect consecutive nodes along each street line.
  const allNodes = [...nodes.values()];
  for (const street of city.streets) {
    for (const line of lines(street.geojson)) {
      const lineFeature = { type: "LineString" as const, coordinates: line };
      const onLine = allNodes
        .map((node) => {
          const snapped = nearestPointOnLine(lineFeature, node.point, {
            units: "kilometers",
          });
          return {
            id: node.id,
            offsetKm: snapped.properties.location,
            distKm: snapped.properties.dist ?? Infinity,
          };
        })
        .filter((p) => p.distKm * 1000 < 35)
        .sort((a, b) => a.offsetKm - b.offsetKm);

      for (let i = 0; i + 1 < onLine.length; i++) {
        const weight = Math.max(
          1,
          (onLine[i + 1].offsetKm - onLine[i].offsetKm) * 1000,
        );
        addEdge(onLine[i].id, onLine[i + 1].id, weight, street.id);
        addEdge(onLine[i + 1].id, onLine[i].id, weight, street.id);
      }
    }
  }

  return { nodes, edges };
}

function nearestNode(graph: RouteGraph, point: LngLat): GraphNode | null {
  let best: GraphNode | null = null;
  let bestD = Infinity;
  for (const node of graph.nodes.values()) {
    const d = distance(point, node.point, { units: "kilometers" });
    if (d < bestD) {
      bestD = d;
      best = node;
    }
  }
  return best;
}

/** Shortest path between two points; returns waypoints or null. */
export function shortestRoute(
  graph: RouteGraph,
  origin: LngLat,
  destination: LngLat,
  blockedStreetIds: Set<string> = new Set(),
): { points: LngLat[]; distanceM: number; streetIds: string[] } | null {
  const start = nearestNode(graph, origin);
  const goal = nearestNode(graph, destination);
  if (!start || !goal) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, { node: string; streetId: string }>();
  const visited = new Set<string>();
  dist.set(start.id, 0);

  // Simple priority selection; graphs here are small (thousands of nodes).
  while (true) {
    let current: string | null = null;
    let currentDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < currentDist) {
        current = id;
        currentDist = d;
      }
    }
    if (current === null) break;
    if (current === goal.id) break;
    visited.add(current);

    for (const edge of graph.edges.get(current) ?? []) {
      if (blockedStreetIds.has(edge.streetId)) continue;
      const next = currentDist + edge.weightM;
      if (next < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, next);
        prev.set(edge.to, { node: current, streetId: edge.streetId });
      }
    }
  }

  if (!dist.has(goal.id)) return null;

  const points: LngLat[] = [];
  const streetIds: string[] = [];
  let cursor: string | undefined = goal.id;
  while (cursor) {
    const node = graph.nodes.get(cursor);
    if (node) points.unshift(node.point);
    const p = prev.get(cursor);
    if (p) streetIds.unshift(p.streetId);
    cursor = p?.node;
    if (cursor === start.id) {
      points.unshift(start.point);
      break;
    }
  }

  return {
    points: [origin, ...points, destination],
    distanceM: dist.get(goal.id) ?? 0,
    streetIds: [...new Set(streetIds)],
  };
}

/**
 * Route similarity: fraction of the reference route that the user's drawn
 * line covers within `toleranceM`.
 */
export function routeCoverage(
  reference: LngLat[],
  drawn: LngLat[],
  toleranceM = 100,
): number {
  if (drawn.length < 2 || reference.length < 2) return 0;
  const drawnLine = { type: "LineString" as const, coordinates: drawn };
  let covered = 0;
  let total = 0;
  for (let i = 0; i + 1 < reference.length; i++) {
    const segmentKm = distance(reference[i], reference[i + 1], { units: "kilometers" });
    const samples = Math.max(2, Math.ceil((segmentKm * 1000) / 50));
    for (let s = 0; s < samples; s++) {
      const t = s / (samples - 1);
      const point: LngLat = [
        reference[i][0] + (reference[i + 1][0] - reference[i][0]) * t,
        reference[i][1] + (reference[i + 1][1] - reference[i][1]) * t,
      ];
      total++;
      const d =
        pointToLineDistance(point, drawnLine, { units: "kilometers" }) * 1000;
      if (d <= toleranceM) covered++;
    }
  }
  return total > 0 ? covered / total : 0;
}
