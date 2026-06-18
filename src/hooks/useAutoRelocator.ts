import { useEffect } from "react";
import { useDispatchStore } from "../stores/dispatchStore";
import { useUnitStore } from "../stores/unitStore";
import { useStationStore } from "../stores/stationStore";
import { useRelocationStore } from "../stores/relocationStore";
import { haversineMeters } from "../utils/geo";
import { GAME_CONFIG } from "../config/gameConfig";
import type { Station, Unit } from "../models";

const {
  checkIntervalMs: CHECK_MS,
  decayMeters: DECAY_M,
  deficiencyThreshold: DEFICIENCY_THRESHOLD,
  surplusThreshold: SURPLUS_THRESHOLD,
  maxConcurrentRelocations: MAX_CONCURRENT,
} = GAME_CONFIG.autoRelocation;

const RELOCATABLE_TYPES = new Set(["Engine", "Rear Mount", "Tower Ladder", "Tractor Trailor", "Rescue", "Squad", "Battalion", "RAC"]);

function computeCoverage(
  lat: number,
  lng: number,
  availableByStation: Map<string, number>,
  stations: Station[]
): number {
  let score = 0;
  for (const s of stations) {
    const count = availableByStation.get(s.id) ?? 0;
    if (count === 0) continue;
    const d = haversineMeters([lng, lat], [s.longitude, s.latitude]);
    score += count * Math.exp(-d / DECAY_M);
  }
  return score;
}

function findRelocationPair(
  units: Unit[],
  stations: Station[],
  inFlightToStationIds: Set<string>
): { unit: Unit; toStationId: string } | null {
  // Build available unit counts and lists per station.
  const availableCount = new Map<string, number>();
  const availableUnits = new Map<string, Unit[]>();
  for (const u of units) {
    if (u.status !== "Available" || !RELOCATABLE_TYPES.has(u.type)) continue;
    availableCount.set(u.currentStationId, (availableCount.get(u.currentStationId) ?? 0) + 1);
    const list = availableUnits.get(u.currentStationId) ?? [];
    list.push(u);
    availableUnits.set(u.currentStationId, list);
  }

  // Compute coverage scores for all stations.
  const scores = new Map<string, number>();
  for (const s of stations) {
    scores.set(s.id, computeCoverage(s.latitude, s.longitude, availableCount, stations));
  }

  // Find deficient stations (sorted most-deficient first), skipping any
  // that already have an incoming auto-relocation in flight.
  const needy = stations
    .filter((s) => (scores.get(s.id) ?? 0) < DEFICIENCY_THRESHOLD && !inFlightToStationIds.has(s.id))
    .sort((a, b) => (scores.get(a.id) ?? 0) - (scores.get(b.id) ?? 0));

  for (const target of needy) {
    // Find the highest-surplus donor that can give up a unit without itself
    // becoming deficient.
    let bestDonor: Station | null = null;
    let bestScore = -Infinity;

    for (const donor of stations) {
      if (donor.id === target.id) continue;
      const count = availableCount.get(donor.id) ?? 0;
      if (count < 2) continue; // must keep at least one unit behind

      const donorScore = scores.get(donor.id) ?? 0;
      if (donorScore <= SURPLUS_THRESHOLD) continue;

      // Removing one unit reduces the donor's self-coverage by 1.0 (exp(0)=1).
      if (donorScore - 1.0 < DEFICIENCY_THRESHOLD) continue;

      if (donorScore > bestScore) {
        bestScore = donorScore;
        bestDonor = donor;
      }
    }

    if (!bestDonor) continue;

    const candidates = availableUnits.get(bestDonor.id) ?? [];
    if (candidates.length === 0) continue;

    // Prefer guest units (not home here) — they're "borrowed" and less disruptive to move.
    const unit =
      candidates.find((u) => u.stationId !== bestDonor!.id) ?? candidates[0];

    return { unit, toStationId: target.id };
  }

  return null;
}

/**
 * When auto-relocation is enabled, periodically checks city-wide FDNY coverage
 * and moves surplus units toward deficient areas. Uses an exponential-decay
 * coverage score so nearby units contribute more weight than distant ones.
 * Never relocates just because a station is empty — only acts when the entire
 * surrounding area is under-covered.
 */
export function useAutoRelocator(): void {
  useEffect(() => {
    const id = window.setInterval(() => {
      const { autoRelocation } = useDispatchStore.getState();
      if (!autoRelocation) return;

      const relocations = useRelocationStore.getState().relocations;
      if (relocations.length >= MAX_CONCURRENT) return;

      const units = useUnitStore.getState().units;
      const stations = useStationStore.getState().stations;
      if (stations.length === 0) return;

      const inFlightTo = new Set(relocations.map((r) => r.toStationId));
      const pair = findRelocationPair(units, stations, inFlightTo);
      if (pair) {
        const fromStation = stations.find((s) => s.id === pair.unit.currentStationId);
        const toStation = stations.find((s) => s.id === pair.toStationId);
        void useRelocationStore.getState().relocateUnit(pair.unit, pair.toStationId);
        useRelocationStore.getState().addRelocationLog({
          id: `log-${pair.unit.id}-${Date.now()}`,
          unitCallsign: pair.unit.callsign,
          unitType: pair.unit.type,
          fromStationName: fromStation?.name ?? pair.unit.currentStationId,
          toStationName: toStation?.name ?? pair.toStationId,
          at: performance.now(),
        });
      }
    }, CHECK_MS);

    return () => window.clearInterval(id);
  }, []);
}
