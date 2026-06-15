import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Incident, Station, Unit } from "../models";
import { fetchRoute, snapToRoad } from "../data/routing";
import {
  buildProgressionFromSegments,
  pointAlong,
  offsetPoint,
  clampToCircle,
  type LngLat,
  type RouteProgression,
} from "../utils/geo";
import { GAME_CONFIG, randomTurnoutMs } from "../config/gameConfig";
import { garageCapacity, garageOccupancy } from "../utils/garage";
import { useStationStore } from "./stationStore";
import { useUnitStore } from "./unitStore";
import { useIncidentStore } from "./incidentStore";
import {
  useRelocationStore,
  relocationCurrentPoint,
  type RelocationRecord,
} from "./relocationStore";
import { isAssignmentStaffed, upgradeCheckDelayMs } from "../utils/assignment";

const START_CALL_RADIUS = GAME_CONFIG.callArea.startRadiusMeters;
const CALL_RADIUS_STEP = GAME_CONFIG.callArea.radiusStepMeters;

export type DispatchPhase = "dispatched" | "enroute" | "onScene" | "returning";

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
  /** Game-time (ms) the unit spends leaving quarters before it starts driving. */
  turnoutMs: number;
}

interface DispatchStore {
  selectedCallId: string | null;
  /** Map point to fly to that isn't tied to a call (e.g. a unit's quarters). */
  focusPoint: LngLat | null;
  focusToken: number;
  dispatches: DispatchRecord[];
  showPaths: boolean;
  dispatching: boolean;
  /** When true, calls are automatically dispatched units to meet their assignment requirements. */
  autoDispatch: boolean;
  /** Simulation speed multiplier (1 = real time). */
  simSpeed: number;

  selectCall: (callId: string) => void;
  focusCall: (callId: string) => void;
  /** Centers the map on an arbitrary point without selecting a call. */
  focusLocation: (point: LngLat) => void;
  clearSelection: () => void;
  togglePaths: () => void;
  toggleAutoDispatch: () => void;
  setSimSpeed: (multiplier: number) => void;
  dispatchUnits: (call: Incident, units: Unit[]) => Promise<void>;
  /** Transitions a unit from "dispatched" (turnout) to "enroute" (driving). */
  beginEnroute: (dispatchId: string) => void;
  markArrived: (dispatchId: string) => void;
  returnToQuarters: (dispatchId: string) => Promise<void>;
  arriveHome: (dispatchId: string) => void;
  resolveCall: (callId: string) => void;
  /** Reposition an on-scene unit within its call's perimeter. */
  moveUnit: (dispatchId: string, point: LngLat) => void;
  /**
   * Checks whether a call's current assignment is fully staffed by on-scene
   * units and updates the resolve timer / upgrade scheduling accordingly.
   */
  evaluateAssignment: (callId: string) => void;
}

const MIN_LEG_MS = GAME_CONFIG.dispatch.minLegMs;
// Real ms a resolved call lingers on the map before it is removed.
const RESOLVED_LINGER_MS = GAME_CONFIG.dispatch.resolvedLingerMs;

// On-scene parking layout. Earlier arrivals park closer to the scene; later
// arrivals fan out behind them via a golden-angle spiral.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const PARK_BASE_M = GAME_CONFIG.dispatch.parkBaseMeters; // first-due distance from the call center
const PARK_STEP_M = GAME_CONFIG.dispatch.parkStepMeters; // extra distance per later arrival
const PARK_EDGE_MARGIN_M = GAME_CONFIG.dispatch.parkEdgeMarginMeters; // keep parked units just inside the perimeter

function legDurationMs(progression: RouteProgression): number {
  return Math.max(MIN_LEG_MS, progression.total * 1000);
}

/** Remaining game-time (ms) until a unit reaches the call, or null if not responding. */
export function remainingArrivalMs(
  record: DispatchRecord,
  simSpeed: number,
  now: number = performance.now()
): number | null {
  if (record.phase === "returning") {
    return null;
  }
  if (record.phase === "onScene") {
    return 0;
  }

  const elapsedGame = (now - record.startedAt) * simSpeed;
  if (record.phase === "dispatched") {
    return Math.max(0, record.turnoutMs - elapsedGame) + record.durationMs;
  }

  return Math.max(0, record.durationMs - elapsedGame);
}

/** Fraction (0..1) of the current leg a record has completed, in game time. */
function legFraction(record: DispatchRecord, simSpeed: number): number {
  const elapsed = (performance.now() - record.startedAt) * simSpeed;
  return Math.min(1, Math.max(0, elapsed / record.durationMs));
}

/** The geographic point a moving dispatch record has reached along its leg now. */
export function dispatchCurrentPoint(
  record: DispatchRecord,
  simSpeed: number
): LngLat {
  const fraction = record.phase === "dispatched" ? 0 : legFraction(record, simSpeed);
  return pointAlong(record.route, record.progression, fraction);
}

/**
 * Where a unit would respond from if dispatched right now, or null if it's
 * unavailable (busy working a call). Idle units roll from their quarters; units
 * relocating or returning to quarters respond from their current road position.
 */
export function dispatchableOrigin(
  unit: Unit,
  dispatches: DispatchRecord[],
  relocations: RelocationRecord[],
  stations: Station[],
  simSpeed: number
): LngLat | null {
  const dispatch = dispatches.find((d) => d.unitId === unit.id);
  if (dispatch) {
    // Committed to a call (turnout / en route / on scene) → not dispatchable.
    return dispatch.phase === "returning"
      ? dispatchCurrentPoint(dispatch, simSpeed)
      : null;
  }
  const relocation = relocations.find((r) => r.unitId === unit.id);
  if (relocation) {
    return relocationCurrentPoint(relocation, simSpeed);
  }
  if (unit.status === "Available") {
    const station = stations.find((s) => s.id === unit.currentStationId);
    return station ? [station.longitude, station.latitude] : null;
  }
  return null;
}

/** Sets an Active call back to Waiting if no units are dispatched, en route, or on scene. */
function freeCallIfEmpty(callId: string, dispatches: DispatchRecord[]): void {
  const stillAssigned = dispatches.some(
    (d) =>
      d.callId === callId &&
      (d.phase === "dispatched" || d.phase === "enroute" || d.phase === "onScene")
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

export const useDispatchStore = create<DispatchStore>()(
  persist(
    (set, get) => ({
  selectedCallId: null,
  focusPoint: null,
  focusToken: 0,
  dispatches: [],
  showPaths: true,
  dispatching: false,
  autoDispatch: false,
  simSpeed: 1,

  selectCall: (callId) => set({ selectedCallId: callId }),
  focusCall: (callId) =>
    set((state) => ({
      selectedCallId: callId,
      focusPoint: null,
      focusToken: state.focusToken + 1,
    })),
  focusLocation: (point) =>
    set((state) => ({
      selectedCallId: null,
      focusPoint: point,
      focusToken: state.focusToken + 1,
    })),
  clearSelection: () => set({ selectedCallId: null, focusPoint: null }),
  togglePaths: () => set((state) => ({ showPaths: !state.showPaths })),
  toggleAutoDispatch: () =>
    set((state) => ({ autoDispatch: !state.autoDispatch })),

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
    useIncidentStore.getState().rebaseTimers(ratio);
    useRelocationStore.getState().rebaseTimers(ratio);
  },

  dispatchUnits: async (call, units) => {
    if (units.length === 0) {
      return;
    }
    set({ dispatching: true });

    const stations = useStationStore.getState().stations;
    const center: LngLat = [call.longitude, call.latitude];
    const simSpeed = get().simSpeed;
    const relocationState = useRelocationStore.getState();
    const existingDispatches = get().dispatches;

    const routed = await Promise.all(
      units.map(async (unit) => {
        // A unit that's already on the road (relocating, or returning to
        // quarters) responds from its current position; an idle unit rolls
        // out of its quarters. Units returning return to their home station;
        // relocating units fall back to the station they left.
        const returning = existingDispatches.find(
          (d) => d.unitId === unit.id && d.phase === "returning"
        );
        const relocation = relocationState.relocations.find(
          (r) => r.unitId === unit.id
        );

        let from: LngLat;
        let returnStationId: string;
        let moving: boolean;

        if (returning) {
          from = dispatchCurrentPoint(returning, simSpeed);
          returnStationId = returning.stationId;
          moving = true;
        } else if (relocation) {
          from = relocationCurrentPoint(relocation, simSpeed);
          returnStationId = relocation.fromStationId;
          moving = true;
        } else {
          const station = stations.find((s) => s.id === unit.currentStationId);
          if (!station) {
            return null;
          }
          from = [station.longitude, station.latitude];
          returnStationId = unit.currentStationId;
          moving = false;
        }

        // Route to the scene; the exact parking spot is assigned on arrival so
        // first-due rigs end up closer than later arrivals.
        const route = await fetchRoute(from, center);
        return { unit, route, returnStationId, moving };
      })
    );

    const startedAt = performance.now();
    const setUnitStatus = useUnitStore.getState().setUnitStatus;

    const records: DispatchRecord[] = [];
    for (const item of routed) {
      if (!item) {
        continue;
      }
      const { unit, route, returnStationId, moving } = item;
      // A unit already on the road skips turnout and rolls straight to enroute.
      relocationState.cancelRelocation(unit.id);
      const progression = buildProgressionFromSegments(route.segmentDurations);
      records.push({
        id: `dsp-${unit.id}`,
        unitId: unit.id,
        callsign: unit.callsign,
        type: unit.type,
        callId: call.id,
        stationId: returnStationId,
        phase: moving ? "enroute" : "dispatched",
        route: route.coordinates,
        progression,
        distanceMeters: route.distanceMeters,
        startedAt,
        durationMs: legDurationMs(progression),
        fallback: route.fallback,
        turnoutMs: moving ? 0 : randomTurnoutMs(),
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

  // Turnout time has elapsed; the unit pulls out of quarters and starts driving.
  beginEnroute: (dispatchId) => {
    set((state) => ({
      dispatches: state.dispatches.map((d) =>
        d.id === dispatchId && d.phase === "dispatched"
          ? { ...d, phase: "enroute" as DispatchPhase, startedAt: performance.now() }
          : d
      ),
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
    }
    // Re-check staffing now that another unit is on scene; this starts the
    // resolve clock once the current assignment's requirements are met.
    get().evaluateAssignment(record.callId);

    // Snap the parked spot onto the nearest street (async), then update it.
    void (async () => {
      const snapped = await snapToRoad(parkPoint);
      const current = get().dispatches.find((d) => d.id === dispatchId);
      if (current?.phase === "onScene") {
        set((state) => ({
          dispatches: state.dispatches.map((d) =>
            d.id === dispatchId ? { ...d, parkPoint: snapped } : d
          ),
        }));
      }
    })();
  },

  returnToQuarters: async (dispatchId) => {
    const record = get().dispatches.find((d) => d.id === dispatchId);
    if (!record || record.phase === "returning") {
      return;
    }

    // Current position of the unit along its present leg. A unit still in
    // turnout (dispatched) hasn't moved from quarters yet.
    const fraction =
      record.phase === "dispatched" ? 0 : legFraction(record, get().simSpeed);
    const from = pointAlong(record.route, record.progression, fraction);

    // A unit that was covering another station (not its own home) may find
    // that station's home unit has since returned, filling its bay. In that
    // case head straight back to its own quarters instead.
    let returnStationId = record.stationId;
    const unit = useUnitStore.getState().units.find((u) => u.id === record.unitId);
    if (unit && unit.stationId !== record.stationId) {
      const units = useUnitStore.getState().units;
      const capacity = garageCapacity(record.stationId, units)[record.type] ?? 0;
      const occupied = garageOccupancy(record.stationId, units)[record.type] ?? 0;
      if (occupied >= capacity) {
        returnStationId = unit.stationId;
      }
    }

    const station = useStationStore
      .getState()
      .stations.find((s) => s.id === returnStationId);
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
              stationId: returnStationId,
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
      return { dispatches, dispatching: false };
    });
    // Re-check staffing now that this unit has left the scene; pauses the
    // resolve clock if the current assignment is no longer fully staffed.
    get().evaluateAssignment(record.callId);
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
    // A returning unit may push its (current) station over capacity for its
    // type, in which case a guest unit relocated there gets sent back home.
    useRelocationStore
      .getState()
      .checkGarageOverflow(record.stationId, record.type, record.unitId);
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
    const center: LngLat | null = incident
      ? [incident.longitude, incident.latitude]
      : null;
    const clamp = (p: LngLat): LngLat =>
      center && incident ? clampToCircle(p, center, incident.radiusMeters) : p;

    const setPark = (p: LngLat) =>
      set((state) => ({
        dispatches: state.dispatches.map((d) =>
          d.id === dispatchId ? { ...d, parkPoint: p } : d
        ),
      }));

    // Immediate clamp into the perimeter, then snap onto the nearest street.
    setPark(clamp(point));
    void (async () => {
      const snapped = clamp(await snapToRoad(clamp(point)));
      if (get().dispatches.some((d) => d.id === dispatchId)) {
        setPark(snapped);
      }
    })();
  },

  evaluateAssignment: (callId) => {
    const incidentStore = useIncidentStore.getState();
    const incident = incidentStore.incidents.find((i) => i.id === callId);
    if (!incident || incident.status === "Resolved") {
      return;
    }
    const assignment = incidentStore.assignments.find(
      (a) => a.id === incident.assignmentId
    );
    if (!assignment) {
      return;
    }
    const onSceneUnits = get().dispatches.filter(
      (d) => d.callId === callId && d.phase === "onScene"
    );
    const staffed = isAssignmentStaffed(assignment, onSceneUnits);

    if (staffed && incident.assignmentMetAt == null) {
      incidentStore.setAssignmentMet(callId, true);
      if (incident.resolveStartedAt == null) {
        incidentStore.startResolveTimer(callId);
      }
      if (assignment.upgradeTo && assignment.upgradeProbability > 0) {
        incidentStore.setNextUpgradeCheck(
          callId,
          performance.now() + upgradeCheckDelayMs(get().simSpeed)
        );
      }
    } else if (!staffed && incident.assignmentMetAt != null) {
      incidentStore.setAssignmentMet(callId, false);
      incidentStore.clearResolveTimer(callId);
      incidentStore.setNextUpgradeCheck(callId, undefined);
    }
  },
    }),
    {
      name: "nyc-dispatch:controls",
      partialize: (state) => ({
        showPaths: state.showPaths,
        autoDispatch: state.autoDispatch,
        simSpeed: state.simSpeed,
      }),
    }
  )
);
