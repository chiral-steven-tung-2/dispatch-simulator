import type { CallSpawnCategory, CallType, Station } from "../models";
import type { LngLat } from "./geo";
import { randomLandPoint } from "../data/nycLand";
import { GAME_CONFIG } from "../config/gameConfig";

/**
 * Picks a spawn category by probability. Probabilities are normalised so they
 * don't need to sum exactly to 1.
 */
function pickCategory(categories: CallSpawnCategory[]): string {
  const total = categories.reduce((s, c) => s + c.probability, 0);
  let roll = Math.random() * total;
  for (const c of categories) {
    roll -= c.probability;
    if (roll <= 0) return c.category;
  }
  return categories[categories.length - 1].category;
}

/**
 * A random location for a call. For borough-specific calls, picks from
 * stations in that borough (no per-borough polygon data exists yet).
 * For city-wide calls, uses the NYC land polygon with a station fallback.
 */
export function randomCallLocation(stations: Station[], borough?: string): LngLat {
  if (borough && borough !== "City-wide") {
    const pool = stations.filter((s) => s.borough === borough);
    const source = pool.length > 0 ? pool : stations;
    const station = source[Math.floor(Math.random() * source.length)];
    return [station.longitude, station.latitude];
  }
  const onLand = randomLandPoint();
  if (onLand) {
    return onLand;
  }
  const station = stations[Math.floor(Math.random() * stations.length)];
  return [station.longitude, station.latitude];
}

/**
 * Builds a fresh waiting call using the two-step spawn system:
 * 1. Pick a category from `callSpawnCategories` by probability.
 * 2. Pick uniformly at random from all call types in that category.
 * Falls back to uniform selection across all types if categories are empty.
 */
export function makeRandomCall(
  callTypes: CallType[],
  callSpawnCategories: CallSpawnCategory[],
  stations: Station[]
) {
  let pool = callTypes;
  if (callSpawnCategories.length > 0) {
    const category = pickCategory(callSpawnCategories);
    const inCategory = callTypes.filter((ct) => ct.category === category);
    if (inCategory.length > 0) {
      pool = inCategory;
    }
  }
  const type = pool[Math.floor(Math.random() * pool.length)];
  const [longitude, latitude] = randomCallLocation(stations, type.spawnBorough);
  return {
    id: `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: type.name,
    latitude,
    longitude,
    status: "Waiting" as const,
    callCategory: type.category,
    radiusMeters: GAME_CONFIG.callArea.startRadiusMeters,
    maxRadiusMeters: type.radius,
    assignmentId: type.assignmentId,
    activeModifiers: [],
    extraRequirements: {},
    requiredUnits: {},
  };
}
