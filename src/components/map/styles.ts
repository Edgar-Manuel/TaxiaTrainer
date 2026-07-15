import type { StyleSpecification } from "maplibre-gl";
import { mapConfig } from "@/lib/config";
import type { MapStyleId } from "@/stores/settings-store";

const OSM_ATTRIBUTION = "© OpenStreetMap contributors";
const CARTO_ATTRIBUTION = "© OpenStreetMap contributors © CARTO";
const ESRI_ATTRIBUTION =
  "© Esri, Maxar, Earthstar Geographics, and the GIS User Community";

function rasterStyle(tiles: string[], attribution: string): StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      base: { type: "raster", tiles, tileSize: 256, attribution, maxzoom: 20 },
    },
    layers: [{ id: "base", type: "raster", source: "base" }],
  };
}

const carto = (variant: string) =>
  ["a", "b", "c", "d"].map(
    (s) =>
      `https://${s}.basemaps.cartocdn.com/rastertiles/${variant}/{z}/{x}/{y}@2x.png`,
  );

/**
 * Resolves the MapLibre style for a given mode.
 * With a MapTiler key we use premium vector styles; otherwise free
 * CARTO/OSM/Esri raster tiles keep the app fully functional at zero cost.
 */
export function getMapStyle(
  styleId: MapStyleId,
  dark: boolean,
): StyleSpecification | string {
  const key = mapConfig.maptilerKey;

  if (styleId === "satellite") {
    if (key) return `https://api.maptiler.com/maps/hybrid/style.json?key=${key}`;
    return rasterStyle(
      [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      ESRI_ATTRIBUTION,
    );
  }

  if (styleId === "no-labels") {
    if (key)
      return `https://api.maptiler.com/maps/dataviz${dark ? "-dark" : ""}/style.json?key=${key}`;
    return rasterStyle(
      carto(dark ? "dark_nolabels" : "light_nolabels"),
      CARTO_ATTRIBUTION,
    );
  }

  if (key)
    return `https://api.maptiler.com/maps/streets-v2${dark ? "-dark" : ""}/style.json?key=${key}`;
  return dark
    ? rasterStyle(carto("dark_all"), CARTO_ATTRIBUTION)
    : rasterStyle(
        ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        OSM_ATTRIBUTION,
      );
}
