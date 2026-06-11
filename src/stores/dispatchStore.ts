import { create } from "zustand";
import type { Incident, Unit } from "../models";
import { fetchRoute } from "../data/routing";
import {
  buildProgressionFromSegments,
  pointAlong,
  offsetPoint,
  clampToCircle,
  type LngLat,
  type RouteProgression,
} from "../utils/geo";
import { START_CALL_RADIUS, CALL_RADIUS_STEP } from "../utils/callArea";
import { useStationStore } from "./stationStore";
import { useUnitStore } from "./unitStore";
import { useIncidentStore } from "./incidentStore";

export type DispatchPhase = "enroute" | "onScene" | "returning";

export interface DispatchRecord {
  id: string;
  unitId: string;
  callsign: string;
  type: string;
  callId: string;
  stationId: string;
  phase: DispatchPhase;
  route: LngLat[];
  /** Progression keyed by per-segment travel time (seconds). */
  progression: RouteProgression;
  distanceMeters: number;
  /** performance.now() timestamp when the current leg began (real time). */
  startedAt: number;
  /** Real driving time for the leg, in ms (before the sim-speed multiplier). */
  durationMs: number;
  /** True if a straight-line fallback was used (routing failed). */
  fallback: boolean;
  /** Where the unit parks on scene (within the call perimeter). */
  parkPoint?: LngLat;
}

interface DispatchStore {
  selectedCallId: string | null;
  dispatches: DispatchRecord[];
  showPaths: boolean;
  dispatching: boolean;
  /** Simulation speed multiplier (1 = real time). */
  simSpeed: number;

  selectCall: (callId: string) => void;
  clearSelection: () => void;
  togglePaths: () => void;
  setSimSpeed: (multiplier: number) => void;
  dispatchUnits: (call: Incident, units: Unit[]) => Promise<void>;
  markArrived: (dispatchId: string) => void;
  returnToQuarters: (dispatchId: string) => Promise<void>;
  arriveHome: (dispatchId: string) => void;
  resolveCall: (callId: string) => void;
  /** Reposition an on-scene unit within its call's perimeter. */
  moveUnit: (dispatchId: string, point: LngLat) => void;
}

const MIN_LEG_MS = 1_000;
// Real ms a resolved call lingers on the map before it is removed.
const RESOLVED_LINGER_MS = 4_000;

// On-scene parking layout. Earlier arrivals park closer to the scene; later
// arrivals fan out behind them via a golden-angle spiral.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const PARK_BASE_M = 6; // first-due distance from the call center
const PARK_STEP_M = 5; // extra distance per later arrival
const PARK_EDGE_MARGIN_M = 3; // keep parked units just inside the perimeter

function legDurationMs(progression: RouteProgression): number {
  return Math.max(MIN_LEG_MS, progression.total * 1000);
}

/** Fraction (0..1) of the current leg a record has completed, in game time. */
function legFraction(record: DispatchRecord, simSpeed: number): number {
  const elapsed = (performance.now() - record.startedAt) * simSpeed;
  return Math.min(1, Math.max(0, elapsed / record.durationMs));
}

/** Sets an Active call back to Waiting if no units are en route or on scene. */
function freeCallIfEmpty(callId: string, dispatches: DispatchRecord[]): void {
  const stillAssigned = dispatches.some(
    (d) => d.callId === callId && (d.phase === "enroute" || d.phase === "onScene")
  );
  if (stillAssigned) {
    return;
  }
  // Don't revive a call that has already resolved.
  const incident = useIncidentStore
    .getState()
    .incidents.find((i) => i.id === callId);
  if (incident?.status === "Active") {
    useIncidentStore.getState().setIncidentStatus(callId, "Waiting");
  }
}

export const useDispatchStore = create<DispatchStore>((set, get) => ({
  selectedCallId: null,
  dispatches: [],
  showPaths: true,
  dispatching: false,
  simSpeed: 60,

  selectCall: (callId) => set({ selectedCallId: callId }),
  clearSelection: () => set({ selectedCallId: null }),
  togglePaths: () => set((state) => ({ showPaths: !state.showPaths })),

  // Rebase each active leg's start time (and call resolve timers) so on-screen
  // positions and countdowns stay continuous across the speed change.
  setSimSpeed: (multiplier) => {
    const now = performance.now();
    const ratio = get().simSpeed / multiplier;
    set((state) => ({
      simSpeed: multiplier,
      dispatches: state.dispatches.map((d) => ({
        ...d,
        startedAt: now - (now - d.startedAt) * ratio,
      })),
    }));
    useIncidentStore.getState().rebaseResolveTimers(ratio);
  },

  dispatchUnits: async (call, units) => {
    if (units.length === 0) {
      return;
    }
    set({ dispatching: true });

    const stations = useStationStore.getState().stations;
    const center: LngLat = [call.longitude, call.latitude];

    const routed = await Promise.all(
      units.map(async (unit) => {
        const station = stations.find((s) => s.id === unit.stationId);
        if (!station) {
          return null;
        }
        const from: LngLat = [station.longitude, station.latitude];
        // Route to the scene; the exact parking spot is assigned on arrival so
        // first-due rigs end up closer than later arrivals.
        const route = await fetchRoute(from, center);
        return { unit, route };
      })
    );

    const startedAt = performance.now();
    const setUnitStatus = useUnitStore.getState().setUnitStatus;

    const records: DispatchRecord[] = [];
    for (const item of routed) {
      if (!item) {
        continue;
      }
      const { unit, route } = item;
      const progression = buildProgressionFromSegments(route.segmentDurations);
      records.push({
        id: `dsp-${unit.id}`,
        unitId: unit.id,
        callsign: unit.callsign,
        type: unit.type,
        callId: call.id,
        stationId: unit.stationId,
        phase: "enroute",
        route: route.coordinates,
        progression,
        distanceMeters: route.distanceMeters,
        startedAt,
        durationMs: legDurationMs(progression),
        fallback: route.fallback,
      });
      setUnitStatus(unit.id, "En Route");
    }

    useIncidentStore.getState().setIncidentStatus(call.id, "Active");

    set((state) => ({
      dispatches: [
        ...state.dispatches.filter((d) => !records.some((r) => r.id === d.id)),
        ...records,
      ],
      dispatching: false,
    }));
  },

  markArrived: (dispatchId) => {
    const record = get().dispatches.find((d) => d.id === dispatchId);
    if (!record || record.phase !== "enroute") {
      return;
    }

    const incidentStore = useIncidentStore.getState();
    const incident = incidentStore.incidents.find((i) => i.id === record.callId);

    // Arrival order (1-based) among units already on scene for this call.
    const order =
      get().dispatches.filter(
        (d) => d.callId === record.callId && d.phase === "onScene"
      ).length + 1;

    const center: LngLat = incident
      ? [incident.longitude, incident.latitude]
      : record.route[record.route.length - 1] ?? [0, 0];

    // Grow the perimeter (start 20m, +2m per arrival, capped at the type max).
    const maxRadius = incident?.maxRadiusMeters ?? START_CALL_RADIUS;
    const newRadius = Math.min(
      maxRadius,
      START_CALL_RADIUS + CALL_RADIUS_STEP * order
    );

    // Park first-due near the center, later arrivals progressively further out,
    // each at a distinct angle so they don't stack.
    const parkDistance = Math.min(
      newRadius - PARK_EDGE_MARGIN_M,
      PARK_BASE_M + (order - 1) * PARK_STEP_M
    );
    const parkPoint = offsetPoint(
      center,
      Math.max(0, parkDistance),
      (order - 1) * GOLDEN_ANGLE
    );

    set((state) => ({
      dispatches: state.dispatches.map((d) =>
        d.id === dispatchId ? { ...d, phase: "onScene", parkPoint } : d
      ),
    }));
    useUnitStore.getState().setUnitStatus(record.unitId, "On Scene");

    if (incident) {
      incidentStore.setCallRadius(record.callId, newRadius);
      // Start the on-scene work clock; the resolve ticker fires when it elapses.
      if (incident.status !== "Resolved" && incident.resolveStartedAt == null) {
        incidentStore.startResolveTimer(record.callId);
      }
    }
  },

  returnToQuarters: async (dispatchId) => {
    const record = get().dispatches.find((d) => d.id === dispatchId);
    if (!record || record.phase === "returning") {
      return;
    }

    // Current position of the unit along its present leg.
    const fraction = legFraction(record, get().simSpeed);
    const from = pointAlong(record.route, record.progression, fraction);

    const station = useStationStore
      .getState()
      .stations.find((s) => s.id === record.stationId);
    if (!station) {
      return;
    }
    const home: LngLat = [station.longitude, station.latitude];

    set({ dispatching: true });
    const route = await fetchRoute(from, home);
    const progression = buildProgressionFromSegments(route.segmentDurations);

    useUnitStore.getState().setUnitStatus(record.unitId, "En Route");

    set((state) => {
      const dispatches = state.dispatches.map((d) =>
        d.id === dispatchId
          ? {
              ...d,
              phase: "returning" as DispatchPhase,
              route: route.coordinates,
              progression,
              distanceMeters: route.distanceMeters,
              startedAt: performance.now(),
              durationMs: legDurationMs(progression),
              fallback: route.fallback,
            }
          : d
      );
      freeCallIfEmpty(record.callId, dispatches);
      // If nobody is on scene anymore, stop the resolve countdown.
      const onSceneRemaining = dispatches.some(
        (d) => d.callId === record.callId && d.phase === "onScene"
      );
      if (!onSceneRemaining) {
        useIncidentStore.getState().clearResolveTimer(record.callId);
      }
      return { dispatches, dispatching: false };
    });
  },

  arriveHome: (dispatchId) => {
    const record = get().dispatches.find((d) => d.id === dispatchId);
    if (!record) {
      return;
    }
    set((state) => ({
      dispatches: state.dispatches.filter((d) => d.id !== dispatchId),
    }));
    useUnitStore.getState().setUnitStatus(record.unitId, "Available");
  },

  resolveCall: (callId) => {
    const incidentStore = useIncidentStore.getState();
    const incident = incidentStore.incidents.find((i) => i.id === callId);
    if (!incident || incident.status === "Resolved") {
      return;
    }
    // Only resolve if a unit is actually on scene right now (units may have
    // been recalled before the timer fired).
    const onScene = get().dispatches.some(
      (d) => d.callId === callId && d.phase === "onScene"
    );
    if (!onScene) {
      incidentStore.clearResolveTimer(callId);
      return;
    }

    incidentStore.setIncidentStatus(callId, "Resolved");

    // Send every unit working this call back to quarters.
    const assigned = get().dispatches.filter(
      (d) => d.callId === callId && d.phase !== "returning"
    );
    for (const d of assigned) {
      void get().returnToQuarters(d.id);
    }

    // Clear the resolved call from the map after a short linger.
    window.setTimeout(
      () => useIncidentStore.getState().removeIncident(callId),
      RESOLVED_LINGER_MS
    );
  },

  moveUnit: (dispatchId, point) => {
    const record = get().dispatches.find((d) => d.id === dispatchId);
    if (!record) {
      return;
    }
    const incident = useIncidentStore
      .getState()
      .incidents.find((i) => i.id === record.callId);
    const parkPoint = incident
      ? clampToCircle(
          point,
          [incident.longitude, incident.latitude],
          incident.radiusMeters
        )
      : point;
    set((state) => ({
      dispatches: state.dispatches.map((d) =>
        d.id === dispatchId ? { ...d, parkPoint } : d
      ),
    }));
  },
}));
