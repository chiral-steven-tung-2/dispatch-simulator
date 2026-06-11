import type {
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { LngLat } from "../utils/geo";
import raw from "./nycBoroughs.json";

// Shoreline-clipped five-borough land polygons (simplified). Used both to draw
// NYC land on the map and to keep spawned calls on land.
export const nycLand = raw as unknown as FeatureCollection<
  Polygon | MultiPolygon,
  { name: string }
>;

type BBox = [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]

const bbox: BBox = computeBbox(nycLand);

function computeBbox(fc: typeof nycLand): BBox {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const polygon of eachPolygon(fc)) {
    for (const ring of polygon) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lat < minLat) minLat = lat;
        if (lng > maxLng) maxLng = lng;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Yields each polygon (array of rings) across all features. */
function* eachPolygon(fc: typeof nycLand): Generator<Position[][]> {
  for (const feature of fc.features) {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
      yield geom.coordinates;
    } else {
      yield* geom.coordinates;
    }
  }
}

/** Ray-casting test: is the point inside a single ring? */
function pointInRing(point: LngLat, ring: Position[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

/** Inside a polygon = inside its outer ring and outside every hole. */
function pointInPolygon(point: LngLat, rings: Position[][]): boolean {
  if (rings.length === 0 || !pointInRing(point, rings[0])) {
    return false;
  }
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(point, rings[i])) {
      return false;
    }
  }
  return true;
}

/** True if the [lng, lat] point is on NYC land. */
export function isOnLand(point: LngLat): boolean {
  if (
    point[0] < bbox[0] ||
    point[0] > bbox[2] ||
    point[1] < bbox[1] ||
    point[1] > bbox[3]
  ) {
    return false;
  }
  for (const polygon of eachPolygon(nycLand)) {
    if (pointInPolygon(point, polygon)) {
      return true;
    }
  }
  return false;
}

/**
 * Returns a uniformly random point on NYC land via rejection sampling within the
 * land bounding box. Returns null if no land point is found within maxTries.
 */
export function randomLandPoint(maxTries = 80): LngLat | null {
  for (let i = 0; i < maxTries; i++) {
    const lng = bbox[0] + Math.random() * (bbox[2] - bbox[0]);
    const lat = bbox[1] + Math.random() * (bbox[3] - bbox[1]);
    if (isOnLand([lng, lat])) {
      return [lng, lat];
    }
  }
  return null;
}
