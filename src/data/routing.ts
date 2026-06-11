import { haversineMeters, type LngLat } from "../utils/geo";

const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";
const OSRM_NEAREST = "https://router.project-osrm.org/nearest/v1/driving";

/**
 * Snaps a point to the nearest drivable road, so parked units sit on the street
 * rather than inside a block. Falls back to the original point on failure.
 */
export async function snapToRoad(point: LngLat): Promise<LngLat> {
  try {
    const response = await fetch(
      `${OSRM_NEAREST}/${point[0]},${point[1]}?number=1`
    );
    if (!response.ok) {
      throw new Error(`OSRM nearest responded ${response.status}`);
    }
    const data = await response.json();
    const location = data?.waypoints?.[0]?.location;
    if (
      data?.code === "Ok" &&
      Array.isArray(location) &&
      location.length === 2
    ) {
      return [location[0], location[1]];
    }
    throw new Error("OSRM nearest returned no snap");
  } catch {
    return point;
  }
}

export interface RouteResult {
  /** Street-following geometry as [lng, lat] coordinates. */
  coordinates: LngLat[];
  /**
   * Per-segment travel time in seconds, one entry per pair of consecutive
   * coordinates (length === coordinates.length - 1). Each segment's speed
   * reflects its road class (highway vs local) from the routing profile.
   */
  segmentDurations: number[];
  /** Total driving distance in meters. */
  distanceMeters: number;
  /** Total driving time in seconds. */
  durationSeconds: number;
  /** True if routing failed and a straight-line fallback was used. */
  fallback: boolean;
}

// Assumed urban speed (m/s) for the straight-line fallback. ~30 mph.
const FALLBACK_SPEED_MPS = 13.4;

/**
 * Fetches a street route between two points from the public OSRM server,
 * including per-segment durations so movement can vary with road class.
 * Falls back to a straight line if the request fails, so dispatch never breaks.
 */
export async function fetchRoute(from: LngLat, to: LngLat): Promise<RouteResult> {
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url =
    `${OSRM_BASE}/${coords}` +
    `?overview=full&geometries=geojson&annotations=duration,distance`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`OSRM responded ${response.status}`);
    }
    const data = await response.json();
    const route = data?.routes?.[0];
    if (data?.code !== "Ok" || !route) {
      throw new Error(`OSRM returned no route (code: ${data?.code})`);
    }

    const coordinates = route.geometry.coordinates as LngLat[];
    const segmentDurations = extractSegmentDurations(route, coordinates);

    return {
      coordinates,
      segmentDurations,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      fallback: false,
    };
  } catch {
    const distanceMeters = haversineMeters(from, to);
    return {
      coordinates: [from, to],
      segmentDurations: [distanceMeters / FALLBACK_SPEED_MPS],
      distanceMeters,
      durationSeconds: distanceMeters / FALLBACK_SPEED_MPS,
      fallback: true,
    };
  }
}

/**
 * Pulls per-segment durations from the route's leg annotations. If they don't
 * line up with the geometry (shouldn't happen), distributes the total duration
 * proportionally to segment lengths so animation still works.
 */
function extractSegmentDurations(
  route: { legs?: { annotation?: { duration?: number[] } }[]; duration: number },
  coordinates: LngLat[]
): number[] {
  const expected = Math.max(0, coordinates.length - 1);
  const fromAnnotation = (route.legs ?? []).flatMap(
    (leg) => leg.annotation?.duration ?? []
  );

  if (fromAnnotation.length === expected && expected > 0) {
    return fromAnnotation;
  }

  // Fallback: split total duration by segment distance.
  const segments: number[] = [];
  let totalDist = 0;
  for (let i = 1; i < coordinates.length; i++) {
    const d = haversineMeters(coordinates[i - 1], coordinates[i]);
    segments.push(d);
    totalDist += d;
  }
  return segments.map((d) =>
    totalDist > 0 ? (d / totalDist) * route.duration : 0
  );
}
