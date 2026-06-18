import { useEffect } from "react";
import { useUnitStore } from "../stores/unitStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { useStationStore } from "../stores/stationStore";
import { usePatrolStore, type PatrolRecord } from "../stores/patrolStore";
import { useSettingsStore } from "../stores/settingsStore";
import { fetchRoute } from "../data/routing";
import { buildProgressionFromSegments, type LngLat } from "../utils/geo";

// Keep OSRM load reasonable while servicing enough concurrent patrol legs.
const MAX_CONCURRENT_ROUTES = 10;
const PATROL_RADIUS_M = 2000;

function randomDestination(center: LngLat): LngLat {
  const dist = 600 + Math.random() * (PATROL_RADIUS_M - 600);
  const angle = Math.random() * 2 * Math.PI;
  const [lng, lat] = center;
  const latDeg = dist / 111320;
  const lngDeg = dist / (111320 * Math.cos((lat * Math.PI) / 180));
  return [lng + Math.cos(angle) * lngDeg, lat + Math.sin(angle) * latDeg];
}

async function buildRoute(
  unitId: string,
  callsign: string,
  stationId: string,
  patrolCenter: LngLat,
  from: LngLat
): Promise<PatrolRecord> {
  const to = randomDestination(patrolCenter);
  const result = await fetchRoute(from, to);
  const progression = buildProgressionFromSegments(result.segmentDurations);
  return {
    unitId,
    callsign,
    stationId,
    patrolCenter,
    route: result.coordinates,
    progression,
    startedAt: performance.now(),
    durationMs: Math.max(result.durationSeconds * 1000, 15000),
    currentPosition: from,
    needsNextLeg: false,
  };
}

// Module-level so concurrency persists across interval ticks.
const routingInFlight = new Set<string>();

/**
 * Assigns and refreshes street-following patrol routes based on the global
 * patrol ratio setting. Handles both ramp-up (add more units) and ramp-down
 * (pull units back to station) when the slider changes.
 */
export function usePatrolMovement(): void {
  useEffect(() => {
    const assign = async () => {
      const units = useUnitStore.getState().units;
      const dispatches = useDispatchStore.getState().dispatches;
      const stations = useStationStore.getState().stations;
      const { records, addPatrol, removePatrol } = usePatrolStore.getState();
      const simSpeed = useDispatchStore.getState().simSpeed;
      const patrolRatio = useSettingsStore.getState().patrolRatio;

      const busyUnitIds = new Set(
        dispatches.filter((d) => d.phase !== "returning").map((d) => d.unitId)
      );
      const stationById = new Map(stations.map((s) => [s.id, s]));

      // Group patrol cars by precinct to compute per-precinct quota.
      const unitsByStation = new Map<string, string[]>();
      for (const unit of units) {
        if (unit.type !== "Patrol Car") continue;
        const list = unitsByStation.get(unit.stationId);
        if (list) list.push(unit.id);
        else unitsByStation.set(unit.stationId, [unit.id]);
      }

      // For each precinct, determine the set of unit IDs that should patrol.
      // Units are sorted by their numeric suffix (unit-1, unit-2 …) so the
      // lowest-numbered ones always patrol first.
      const shouldPatrolIds = new Set<string>();
      for (const [, unitIds] of unitsByStation) {
        const sorted = [...unitIds].sort((a, b) => {
          const na = parseInt(a.split("-unit-")[1] ?? "0", 10);
          const nb = parseInt(b.split("-unit-")[1] ?? "0", 10);
          return na - nb;
        });
        const quota = Math.round(sorted.length * patrolRatio);
        for (let i = 0; i < quota; i++) shouldPatrolIds.add(sorted[i]);
      }

      // Pull back units that are no longer within the quota (ratio was reduced).
      for (const r of records) {
        if (!shouldPatrolIds.has(r.unitId) && !busyUnitIds.has(r.unitId)) {
          removePatrol(r.unitId);
          routingInFlight.delete(r.unitId);
        }
      }

      if (routingInFlight.size >= MAX_CONCURRENT_ROUTES) return;

      const patrolUnitIds = new Set(usePatrolStore.getState().records.map((r) => r.unitId));

      // Priority 1: active patrol units whose leg just finished need a next route.
      for (const r of usePatrolStore.getState().records) {
        if (!r.needsNextLeg) continue;
        if (routingInFlight.has(r.unitId)) continue;
        if (routingInFlight.size >= MAX_CONCURRENT_ROUTES) return;

        routingInFlight.add(r.unitId);
        buildRoute(r.unitId, r.callsign, r.stationId, r.patrolCenter, r.currentPosition)
          .then(addPatrol)
          .catch(() => {/* keep record with needsNextLeg=true; next tick retries */})
          .finally(() => routingInFlight.delete(r.unitId));
      }

      if (routingInFlight.size >= MAX_CONCURRENT_ROUTES) return;

      // Priority 2: units within quota that haven't started patrolling yet.
      for (const unit of units) {
        if (unit.type !== "Patrol Car") continue;
        if (!shouldPatrolIds.has(unit.id)) continue;
        if (unit.status !== "Available") continue;
        if (patrolUnitIds.has(unit.id)) continue;
        if (busyUnitIds.has(unit.id)) continue;
        if (routingInFlight.has(unit.id)) continue;
        if (routingInFlight.size >= MAX_CONCURRENT_ROUTES) return;

        const station = stationById.get(unit.currentStationId);
        if (!station) continue;

        const center: LngLat = [station.longitude, station.latitude];
        const from = usePatrolStore.getState().getCurrentPoint(unit.id, simSpeed) ?? center;

        routingInFlight.add(unit.id);
        buildRoute(unit.id, unit.callsign, unit.currentStationId, center, from)
          .then(addPatrol)
          .catch(() => {/* will retry next tick */})
          .finally(() => routingInFlight.delete(unit.id));
      }
    };

    void assign();
    const id = window.setInterval(() => void assign(), 400);
    return () => window.clearInterval(id);
  }, []);
}
