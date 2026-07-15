export type LngLat = [number, number];

export interface PointGeometry {
  type: "Point";
  coordinates: LngLat;
}

export interface LineStringGeometry {
  type: "LineString";
  coordinates: LngLat[];
}

export interface MultiLineStringGeometry {
  type: "MultiLineString";
  coordinates: LngLat[][];
}

export interface PolygonGeometry {
  type: "Polygon";
  coordinates: LngLat[][];
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: LngLat[][][];
}

export type StreetGeometry = LineStringGeometry | MultiLineStringGeometry;
export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry;

export interface BBox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}
