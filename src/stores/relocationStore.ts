import { create } from "zustand";
import type { Unit } from "../models";
import { fetchRoute } from "../data/routing";
import {
  buildProgressionFromSegments,
  pointAlong,
  type LngLat,
  type RouteProgression,
} from "../utils/geo";
import { garageCapacity, garageOccupancy } from "../utils/garage";
import { GAME_CONFIG } from "../config/gameConfig";
import { useStationStore } from "./stationStore";
import { useUnitStore } from "./unitStore";
import { useDispatchStore } from "./dispatchStore";

const MIN_LEG_MS = GAME_CONFIG.dispatch.minLegMs;

function legDurationMs(progression: RouteProgression): number {
  return Math.max(MIN_LEG_MS, progression.total * 1000);
}

/** The geographic point a relocating unit has reached along its leg right now. */
export function relocationCurrentPoint(
  record: RelocationRecord,
  simSpeed: number,
  now: number = performance.now()
): LngLat {
  const elapsed = (now - record.startedAt) * simSpeed;
  const fraction = Math.min(1, Math.max(0, elapsed / record.durationMs));
  return pointAlong(record.route, record.progression, fraction);
}

export interface RelocationRecord {
  id: string;
  unitId: string;
  callsign: string;
  type: string;
  fromStationId: string;
  toStationId: string;
  route: LngLat[];
  /** Progression keyed by per-segment travel time (seconds). */
  progression: RouteProgression;
  distanceMeters: number;
  /** performance.now() timestamp when the leg began (real time). */
  startedAt: number;
  /** Real driving time for the leg, in ms (before the sim-speed multiplier). */
  durationMs: number;
  /** True if a straight-line fallback was used (routing failed). */
  fallback: boolean;
}

interface RelocationStore {
  relocations: RelocationRecord[];
  relocating: boolean;
  relocateUnit: (unit: Unit, toStationId: string) => Promise<void>;
  arriveRelocation: (id: string) => void;
  /** Drops an in-flight relocation (e.g. the unit is being dispatched to a call). */
  cancelRelocation: (unitId: string) => void;
  /** Cancels an in-flight relocation by turning the unit around: it drives
   *  back to the station it departed from (rather than teleporting there). */
  cancelRelocationFully: (unitId: string) => Promise<void>;
  sendUnitHome: (unit: Unit) => Promise<void>;
  /**
   * If `type` is over its garage capacity at `stationId`, sends a guest unit
   * (one whose home isn't `stationId`) of that type back to its own station.
   */
  checkGarageOverflow: (
    stationId: string,
    type: string,
    justArrivedUnitId?: string
  ) => void;
  /** Keep in-flight legs' on-screen positions continuous across a sim-speed change. */
  rebaseTimers: (ratio: number) => void;
}

export const useRelocationStore = create<RelocationStore>((set, get) => ({
  relocations: [],
  relocating: false,

  relocateUnit: async (unit, toStationId) => {
    if (unit.currentStationId === toStationId) {
      return;
    }
    const stations = useStationStore.getState().stations;
    const from = stations.find((s) => s.id === unit.currentStationId);
    const to = stations.find((s) => s.id === toStationId);
    if (!from || !to) {
      return;
    }

    set({ relocating: true });

    const route = await fetchRoute(
      [from.longitude, from.latitude],
      [to.longitude, to.latitude]
    );
    const progression = buildProgressionFromSegments(route.segmentDurations);

    useUnitStore.getState().setUnitStatus(unit.id, "Relocating");

    const record: RelocationRecord = {
      id: `reloc-${unit.id}`,
      unitId: unit.id,
      callsign: unit.callsign,
      type: unit.type,
      fromStationId: unit.currentStationId,
      toStationId,
      route: route.coordinates,
      progression,
      distanceMeters: route.distanceMeters,
      startedAt: performance.now(),
      durationMs: legDurationMs(progression),
      fallback: route.fallback,
    };

    set((state) => ({
      relocations: [
        ...state.relocations.filter((r) => r.id !== record.id),
        record,
      ],
      relocating: false,
    }));
  },

  arriveRelocation: (id) => {
    const record = get().relocations.find((r) => r.id === id);
    if (!record) {
      return;
    }

    useUnitStore.getState().arriveAtStation(record.unitId, record.toStationId);

    set((state) => ({
      relocations: state.relocations.filter((r) => r.id !== id),
    }));

    get().checkGarageOverflow(record.toStationId, record.type, record.unitId);
  },

  cancelRelocation: (unitId) => {
    set((state) => ({
      relocations: state.relocations.filter((r) => r.unitId !== unitId),
    }));
  },

  cancelRelocationFully: async (unitId) => {
    const record = get().relocations.find((r) => r.unitId === unitId);
    if (!record) {
      return;
    }

    const simSpeed = useDispatchStore.getState().simSpeed;
    const from = relocationCurrentPoint(record, simSpeed);
    const origin = useStationStore
      .getState()
      .stations.find((s) => s.id === record.fromStationId);
    if (!origin) {
      set((state) => ({
        relocations: state.relocations.filter((r) => r.unitId !== unitId),
      }));
      useUnitStore.getState().setUnitStatus(unitId, "Available");
      return;
    }

    const route = await fetchRoute(from, [origin.longitude, origin.latitude]);
    const progression = buildProgressionFromSegments(route.segmentDurations);

    set((state) => ({
      relocations: state.relocations.map((r) =>
        r.id === record.id
          ? {
              ...r,
              fromStationId: record.toStationId,
              toStationId: record.fromStationId,
              route: route.coordinates,
              progression,
              distanceMeters: route.distanceMeters,
              startedAt: performance.now(),
              durationMs: legDurationMs(progression),
              fallback: route.fallback,
            }
          : r
      ),
    }));
  },

  sendUnitHome: async (unit) => {
    if (unit.currentStationId === unit.stationId) {
      return;
    }
    await get().relocateUnit(unit, unit.stationId);
  },

  checkGarageOverflow: (stationId, type, justArrivedUnitId) => {
    const units = useUnitStore.getState().units;
    const capacity = garageCapacity(stationId, units)[type] ?? 0;
    const occupied = garageOccupancy(stationId, units)[type] ?? 0;

    // Cancel any in-flight relocations heading here that no longer have a bay
    // to land in now that occupancy has changed (e.g. the home unit just
    // pulled back into quarters before the covering unit arrived).
    const incoming = get().relocations.filter(
      (r) => r.toStationId === stationId && r.type === type
    );
    const openSlots = Math.max(0, capacity - occupied);
    for (const r of incoming.slice(openSlots)) {
      void get().cancelRelocationFully(r.unitId);
    }

    if (occupied <= capacity) {
      return;
    }

    const guests = units.filter(
      (u) =>
        u.currentStationId === stationId &&
        u.stationId !== stationId &&
        u.type === type &&
        u.status === "Available"
    );
    const candidate =
      guests.find((u) => u.id !== justArrivedUnitId) ?? guests[0];
    if (candidate) {
      void get().sendUnitHome(candidate);
    }
  },

  rebaseTimers: (ratio) => {
    const now = performance.now();
    set((state) => ({
      relocations: state.relocations.map((r) => ({
        ...r,
        startedAt: now - (now - r.startedAt) * ratio,
      })),
    }));
  },
}));
