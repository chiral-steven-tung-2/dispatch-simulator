import type { CallType, Station } from "../models";
import type { LngLat } from "./geo";
import { randomLandPoint } from "../data/nycLand";
import { START_CALL_RADIUS } from "./callArea";

/** Picks an item using its `weight` as relative probability. */
export function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll <= 0) {
      return item;
    }
  }
  return items[items.length - 1];
}

/**
 * A random on-land location somewhere in NYC. Uses the borough land polygon; if
 * rejection sampling somehow fails, falls back to a random firehouse location
 * (which is always on land).
 */
export function randomCallLocation(stations: Station[]): LngLat {
  const onLand = randomLandPoint();
  if (onLand) {
    return onLand;
  }
  const station = stations[Math.floor(Math.random() * stations.length)];
  return [station.longitude, station.latitude];
}

/** Builds a fresh waiting call from a weighted-random type at a random location. */
export function makeRandomCall(callTypes: CallType[], stations: Station[]) {
  const type = pickWeighted(callTypes);
  const [longitude, latitude] = randomCallLocation(stations);
  return {
    id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: type.name,
    latitude,
    longitude,
    status: "Waiting" as const,
    radiusMeters: START_CALL_RADIUS,
    maxRadiusMeters: type.radius,
  };
}
