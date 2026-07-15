"use client";

import maplibregl, {
  Map as MLMap,
  type LngLatBoundsLike,
  type MapMouseEvent,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useSettings, type MapStyleId } from "@/stores/settings-store";
import type { LngLat } from "@/types/geo";
import { getMapStyle } from "./styles";

export interface MapHighlight {
  id: string;
  geometry: GeoJSON.Geometry;
  color: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
  /** Pulsing attention animation. */
  animated?: boolean;
  /** Draw direction arrows along the line. */
  arrows?: boolean;
  fill?: boolean;
}

export interface MapMarker {
  id: string;
  point: LngLat;
  label?: string;
  emoji?: string;
  color?: string;
}

interface CityMapProps {
  center: LngLat;
  zoom?: number;
  bbox?: [number, number, number, number] | null;
  styleId?: MapStyleId;
  highlights?: MapHighlight[];
  markers?: MapMarker[];
  heatmapPoints?: LngLat[];
  onMapClick?: (lngLat: LngLat) => void;
  /** Fit the viewport to these geometries whenever the value changes. */
  fitTo?: GeoJSON.Geometry[] | null;
  fitPadding?: number;
  interactive?: boolean;
  className?: string;
}

function boundsOf(geometries: GeoJSON.Geometry[]): LngLatBoundsLike | null {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const visit = (coords: unknown): void => {
    if (typeof (coords as number[])[0] === "number") {
      const [lng, lat] = coords as number[];
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    } else {
      for (const c of coords as unknown[]) visit(c);
    }
  };
  for (const g of geometries) {
    if ("coordinates" in g) visit(g.coordinates);
  }
  if (!isFinite(minLng)) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}

const HL_PREFIX = "tt-hl-";
const MARKER_SOURCE = "tt-markers";
const HEATMAP_SOURCE = "tt-heatmap";

export function CityMap({
  center,
  zoom = 13.5,
  bbox,
  styleId,
  highlights = [],
  markers = [],
  heatmapPoints = [],
  onMapClick,
  fitTo,
  fitPadding = 60,
  interactive = true,
  className,
}: CityMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const overlaysRef = useRef({ highlights, markers, heatmapPoints });
  const animationRef = useRef<number>(0);
  const clickRef = useRef(onMapClick);
  const globalStyle = useSettings((s) => s.mapStyle);
  const effectiveStyle: MapStyleId = styleId ?? globalStyle;

  overlaysRef.current = { highlights, markers, heatmapPoints };
  clickRef.current = onMapClick;

  // Init once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const dark = document.documentElement.classList.contains("dark");
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(effectiveStyle, dark),
      center,
      zoom,
      attributionControl: { compact: true },
      maxZoom: 20,
      dragRotate: true,
    });
    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );
    map.on("load", () => applyOverlays(map));
    map.on("click", (e: MapMouseEvent) => {
      clickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
    });
    mapRef.current = map;

    return () => {
      cancelAnimationFrame(animationRef.current);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Style switching (mode / theme changes).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyStyle = () => {
      const dark = document.documentElement.classList.contains("dark");
      map.setStyle(getMapStyle(effectiveStyle, dark));
      map.once("styledata", () => applyOverlays(map));
    };
    applyStyle();

    const observer = new MutationObserver(applyStyle);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveStyle]);

  // Overlay updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    applyOverlays(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlights, markers, heatmapPoints]);

  // Fit to geometry.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (fitTo && fitTo.length > 0) {
      const bounds = boundsOf(fitTo);
      if (bounds) map.fitBounds(bounds, { padding: fitPadding, maxZoom: 17 });
    } else if (bbox) {
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 24 },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTo]);

  function applyOverlays(map: MLMap) {
    const { highlights, markers, heatmapPoints } = overlaysRef.current;
    cancelAnimationFrame(animationRef.current);

    // Remove stale highlight layers/sources.
    for (const layer of [...map.getStyle().layers]) {
      if (layer.id.startsWith(HL_PREFIX)) map.removeLayer(layer.id);
    }
    for (const sourceId of Object.keys(map.getStyle().sources)) {
      if (sourceId.startsWith(HL_PREFIX)) map.removeSource(sourceId);
    }

    const animatedLayers: string[] = [];

    for (const hl of highlights) {
      const sourceId = `${HL_PREFIX}${hl.id}`;
      map.addSource(sourceId, {
        type: "geojson",
        data: { type: "Feature", properties: {}, geometry: hl.geometry },
      });
      const isArea =
        hl.geometry.type === "Polygon" || hl.geometry.type === "MultiPolygon";

      if (isArea && hl.fill !== false) {
        map.addLayer({
          id: `${sourceId}-fill`,
          type: "fill",
          source: sourceId,
          paint: { "fill-color": hl.color, "fill-opacity": 0.25 },
        });
      }
      map.addLayer({
        id: `${sourceId}-line`,
        type: "line",
        source: sourceId,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": hl.color,
          "line-width": hl.width ?? 5,
          "line-opacity": hl.opacity ?? 0.9,
          ...(hl.dashed ? { "line-dasharray": [2, 2] } : {}),
        },
      });
      if (hl.animated) animatedLayers.push(`${sourceId}-line`);
      if (hl.arrows) {
        map.addLayer({
          id: `${sourceId}-arrows`,
          type: "symbol",
          source: sourceId,
          layout: {
            "symbol-placement": "line",
            "symbol-spacing": 60,
            "text-field": "▶",
            "text-size": 12,
            "text-keep-upright": false,
            "text-rotation-alignment": "map",
            "text-allow-overlap": true,
          },
          paint: { "text-color": hl.color, "text-halo-color": "#ffffff", "text-halo-width": 1 },
        });
      }
    }

    // Markers.
    if (map.getLayer(`${MARKER_SOURCE}-label`)) map.removeLayer(`${MARKER_SOURCE}-label`);
    if (map.getLayer(`${MARKER_SOURCE}-dot`)) map.removeLayer(`${MARKER_SOURCE}-dot`);
    if (map.getSource(MARKER_SOURCE)) map.removeSource(MARKER_SOURCE);
    if (markers.length > 0) {
      map.addSource(MARKER_SOURCE, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: markers.map((m) => ({
            type: "Feature",
            properties: {
              label: m.emoji ? `${m.emoji} ${m.label ?? ""}`.trim() : (m.label ?? ""),
              color: m.color ?? "#2563eb",
            },
            geometry: { type: "Point", coordinates: m.point },
          })),
        },
      });
      map.addLayer({
        id: `${MARKER_SOURCE}-dot`,
        type: "circle",
        source: MARKER_SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });
      map.addLayer({
        id: `${MARKER_SOURCE}-label`,
        type: "symbol",
        source: MARKER_SOURCE,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 13,
          "text-offset": [0, 1.2],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#111827",
          "text-halo-color": "#ffffff",
          "text-halo-width": 1.5,
        },
      });
    }

    // Error heatmap.
    if (map.getLayer(HEATMAP_SOURCE)) map.removeLayer(HEATMAP_SOURCE);
    if (map.getSource(HEATMAP_SOURCE)) map.removeSource(HEATMAP_SOURCE);
    if (heatmapPoints.length > 0) {
      map.addSource(HEATMAP_SOURCE, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: heatmapPoints.map((p) => ({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: p },
          })),
        },
      });
      map.addLayer({
        id: HEATMAP_SOURCE,
        type: "heatmap",
        source: HEATMAP_SOURCE,
        paint: {
          "heatmap-radius": 30,
          "heatmap-intensity": 1.2,
          "heatmap-opacity": 0.7,
        },
      });
    }

    // Pulse animation for attention highlights.
    if (animatedLayers.length > 0) {
      const start = performance.now();
      const pulse = (t: number) => {
        if (!mapRef.current) return;
        const phase = (Math.sin((t - start) / 300) + 1) / 2;
        for (const layerId of animatedLayers) {
          if (map.getLayer(layerId)) {
            map.setPaintProperty(layerId, "line-opacity", 0.45 + phase * 0.55);
          }
        }
        animationRef.current = requestAnimationFrame(pulse);
      };
      animationRef.current = requestAnimationFrame(pulse);
    }
  }

  return (
    <div
      ref={containerRef}
      className={className ?? "h-full w-full"}
      style={interactive ? undefined : { pointerEvents: "none" }}
    />
  );
}
