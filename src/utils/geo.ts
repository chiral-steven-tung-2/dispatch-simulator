export type LngLat = [number, number];

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

const METERS_PER_DEG_LAT = 111_320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos(toRad(lat));
}

/** A closed ring approximating a circle of `radiusMeters` around `center`. */
export function circlePolygon(
  center: LngLat,
  radiusMeters: number,
  steps = 48
): LngLat[] {
  const [lng, lat] = center;
  const dLat = radiusMeters / METERS_PER_DEG_LAT;
  const dLng = radiusMeters / metersPerDegLng(lat);
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta)]);
  }
  return ring;
}

/** A uniformly random point within `radiusMeters` of `center`. */
export function randomPointInCircle(center: LngLat, radiusMeters: number): LngLat {
  const [lng, lat] = center;
  const r = radiusMeters * Math.sqrt(Math.random());
  const theta = Math.random() * 2 * Math.PI;
  return [
    lng + (r * Math.cos(theta)) / metersPerDegLng(lat),
    lat + (r * Math.sin(theta)) / METERS_PER_DEG_LAT,
  ];
}

/** Point at `distanceMeters` from `center` along `angleRad` (0 = east, CCW). */
export function offsetPoint(
  center: LngLat,
  distanceMeters: number,
  angleRad: number
): LngLat {
  const [lng, lat] = center;
  return [
    lng + (distanceMeters * Math.cos(angleRad)) / metersPerDegLng(lat),
    lat + (distanceMeters * Math.sin(angleRad)) / METERS_PER_DEG_LAT,
  ];
}

/** Clamps `point` to lie within `radiusMeters` of `center`. */
export function clampToCircle(
  point: LngLat,
  center: LngLat,
  radiusMeters: number
): LngLat {
  const dxm = (point[0] - center[0]) * metersPerDegLng(center[1]);
  const dym = (point[1] - center[1]) * METERS_PER_DEG_LAT;
  const dist = Math.hypot(dxm, dym);
  if (dist <= radiusMeters || dist === 0) {
    return point;
  }
  const f = radiusMeters / dist;
  return [
    center[0] + (point[0] - center[0]) * f,
    center[1] + (point[1] - center[1]) * f,
  ];
}

/** Great-circle distance between two [lng, lat] points, in meters. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Format a distance in meters as a short human string (e.g. "1.2 km", "740 m"). */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
}

/** True if `point` is inside the ring using the even-odd (ray casting) rule. */
function ringContains(point: LngLat, ring: LngLat[]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi !== yj &&
      y >= Math.min(yi, yj) &&
      y < Math.max(yi, yj) &&
      x < xi + ((y - yi) / (yj - yi)) * (xj - xi)
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * True if `point` is inside `rings[0]` (the outer ring) and not inside any of
 * `rings[1..]` (holes). Holes themselves use the even-odd rule, so this is
 * equivalent to XOR-ing crossings across all rings.
 */
export function polygonContains(point: LngLat, rings: LngLat[][]): boolean {
  let inside = false;
  for (const ring of rings) {
    if (ringContains(point, ring)) {
      inside = !inside;
    }
  }
  return inside;
}

/** True if `point` is inside any polygon of a MultiPolygon's coordinates. */
export function multiPolygonContains(
  point: LngLat,
  polygons: LngLat[][][]
): boolean {
  return polygons.some((rings) => polygonContains(point, rings));
}

/** Bounding box `[minLng, minLat, maxLng, maxLat]` of a MultiPolygon's coordinates. */
export function multiPolygonBounds(
  polygons: LngLat[][][]
): [number, number, number, number] {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

/**
 * A uniformly random point inside a MultiPolygon, via bounding-box rejection
 * sampling. Falls back to the bounding-box center if no point is found within
 * `maxAttempts` (e.g. for a degenerate/empty polygon).
 */
export function randomPointInPolygon(
  polygons: LngLat[][][],
  maxAttempts = 50
): LngLat {
  const [minLng, minLat, maxLng, maxLat] = multiPolygonBounds(polygons);
  for (let i = 0; i < maxAttempts; i++) {
    const candidate: LngLat = [
      minLng + Math.random() * (maxLng - minLng),
      minLat + Math.random() * (maxLat - minLat),
    ];
    if (multiPolygonContains(candidate, polygons)) {
      return candidate;
    }
  }
  return [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
}

export interface RouteProgression {
  /** Cumulative distance (m) from the start to each coordinate. */
  cumulative: number[];
  /** Total route length in meters. */
  total: number;
}

/** Precomputes cumulative distances along a polyline for fast interpolation. */
export function buildProgression(coords: LngLat[]): RouteProgression {
  const cumulative: number[] = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineMeters(coords[i - 1], coords[i]);
    cumulative.push(total);
  }
  return { cumulative, total };
}

/**
 * Builds a progression from per-segment metrics (e.g. travel durations) rather
 * than geometric distance. Interpolating against this makes a unit advance at
 * each segment's own speed — faster on highways, slower on local streets.
 */
export function buildProgressionFromSegments(
  segments: number[]
): RouteProgression {
  const cumulative: number[] = [0];
  let total = 0;
  for (const segment of segments) {
    total += segment;
    cumulative.push(total);
  }
  return { cumulative, total };
}

/**
 * Returns the [lng, lat] position at a given fraction (0..1) along the route,
 * interpolating linearly between the polyline vertices by distance.
 */
export function pointAlong(
  coords: LngLat[],
  progression: RouteProgression,
  fraction: number
): LngLat {
  if (coords.length === 0) {
    return [0, 0];
  }
  if (coords.length === 1 || fraction <= 0) {
    return coords[0];
  }
  if (fraction >= 1) {
    return coords[coords.length - 1];
  }

  const target = fraction * progression.total;
  const { cumulative } = progression;

  // Find the segment containing the target distance.
  let i = 1;
  while (i < cumulative.length && cumulative[i] < target) {
    i++;
  }

  const segStart = cumulative[i - 1];
  const segEnd = cumulative[i];
  const segLength = segEnd - segStart || 1;
  const t = (target - segStart) / segLength;

  const a = coords[i - 1];
  const b = coords[i];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * Returns the portion of the route still ahead of the given fraction: the
 * current interpolated position followed by all remaining vertices. Used to draw
 * a path line from the moving unit to its destination.
 */
export function remainingPath(
  coords: LngLat[],
  progression: RouteProgression,
  fraction: number
): LngLat[] {
  if (coords.length <= 1 || fraction <= 0) {
    return coords;
  }
  if (fraction >= 1) {
    return [coords[coords.length - 1]];
  }
  const target = fraction * progression.total;
  const { cumulative } = progression;

  let i = 1;
  while (i < cumulative.length && cumulative[i] < target) {
    i++;
  }
  return [pointAlong(coords, progression, fraction), ...coords.slice(i)];
}
