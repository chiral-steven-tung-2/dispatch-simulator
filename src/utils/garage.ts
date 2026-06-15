import type { Station, Unit } from "../models";
import { haversineMeters, type LngLat } from "./geo";

/**
 * Counts units of each type permanently quartered (home) at a station — this
 * is the station's max garage space ("capacity") per apparatus type.
 */
export function garageCapacity(
  stationId: string,
  units: Unit[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) {
    if (unit.stationId === stationId) {
      counts[unit.type] = (counts[unit.type] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Counts units of each type currently parked (Available, in quarters) at a
 * station, whether that's their home or a relocation destination.
 */
export function garageOccupancy(
  stationId: string,
  units: Unit[]
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const unit of units) {
    if (unit.currentStationId === stationId && unit.status === "Available") {
      counts[unit.type] = (counts[unit.type] ?? 0) + 1;
    }
  }
  return counts;
}

export interface GarageSlot {
  type: string;
  capacity: number;
  occupied: number;
}

/** Garage summary for a station: one row per unit type with home capacity here. */
export function garageSlots(stationId: string, units: Unit[]): GarageSlot[] {
  const capacity = garageCapacity(stationId, units);
  const occupancy = garageOccupancy(stationId, units);
  return Object.entries(capacity)
    .map(([type, cap]) => ({
      type,
      capacity: cap,
      occupied: occupancy[type] ?? 0,
    }))
    .sort((a, b) => a.type.localeCompare(b.type));
}

/**
 * Callsign of the home unit a relocating unit is acting in place of: a unit of
 * the same type permanently quartered at the destination, preferring one that's
 * currently away (whose open bay the guest is filling). Returns undefined for a
 * unit returning to its own home, or when no matching home unit exists.
 */
export function replacingUnitName(
  toStationId: string,
  type: string,
  relocatingUnitId: string,
  units: Unit[]
): string | undefined {
  const homeUnits = units.filter(
    (u) =>
      u.stationId === toStationId &&
      u.type === type &&
      u.id !== relocatingUnitId
  );
  const away = homeUnits.find(
    (u) => u.currentStationId !== toStationId || u.status !== "Available"
  );
  return (away ?? homeUnits[0])?.callsign;
}

export interface RelocationTarget {
  station: Station;
  distanceMeters: number;
  openSlots: number;
}

/**
 * Stations (other than `excludeStationId`) with at least one open bay for
 * `type`, sorted by distance from `from`.
 */
export function relocationTargets(
  type: string,
  excludeStationId: string,
  stations: Station[],
  units: Unit[],
  from: LngLat
): RelocationTarget[] {
  const targets: RelocationTarget[] = [];
  for (const station of stations) {
    if (station.id === excludeStationId) {
      continue;
    }
    const capacity = garageCapacity(station.id, units)[type] ?? 0;
    const occupied = garageOccupancy(station.id, units)[type] ?? 0;
    const openSlots = capacity - occupied;
    if (openSlots <= 0) {
      continue;
    }
    targets.push({
      station,
      openSlots,
      distanceMeters: haversineMeters(from, [
        station.longitude,
        station.latitude,
      ]),
    });
  }
  return targets.sort((a, b) => a.distanceMeters - b.distanceMeters);
}
