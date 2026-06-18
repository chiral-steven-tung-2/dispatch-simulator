import { create } from "zustand";
import {
  pointAlong,
  type LngLat,
  type RouteProgression,
} from "../utils/geo";

export interface PatrolRecord {
  unitId: string;
  callsign: string;
  stationId: string;
  /** Precinct center — used to pick next patrol destinations. */
  patrolCenter: LngLat;
  route: LngLat[];
  progression: RouteProgression;
  /** performance.now() timestamp when this leg started. */
  startedAt: number;
  /** Real-time ms for this leg (multiply elapsed by simSpeed before dividing). */
  durationMs: number;
  /** Saved when a leg finishes so the next fetch starts from here. */
  currentPosition: LngLat;
  /** True while waiting for the next route to be fetched. */
  needsNextLeg: boolean;
}

interface PatrolStore {
  records: PatrolRecord[];
  addPatrol: (record: PatrolRecord) => void;
  removePatrol: (unitId: string) => void;
  /** Called by the animation layer when a unit arrives at its destination. */
  completeLeg: (unitId: string) => void;
  /** Returns the unit's interpolated map position, or null if not patrolling. */
  getCurrentPoint: (unitId: string, simSpeed: number) => LngLat | null;
}

export const usePatrolStore = create<PatrolStore>((set, get) => ({
  records: [],

  addPatrol: (record) =>
    set((s) => ({
      records: [...s.records.filter((r) => r.unitId !== record.unitId), record],
    })),

  removePatrol: (unitId) =>
    set((s) => ({ records: s.records.filter((r) => r.unitId !== unitId) })),

  completeLeg: (unitId) =>
    set((s) => ({
      records: s.records.map((r) =>
        r.unitId === unitId
          ? { ...r, needsNextLeg: true, currentPosition: r.route[r.route.length - 1] ?? r.currentPosition }
          : r
      ),
    })),

  getCurrentPoint: (unitId, simSpeed) => {
    const record = get().records.find((r) => r.unitId === unitId);
    if (!record) return null;
    if (record.needsNextLeg) return record.currentPosition;
    const elapsed = (performance.now() - record.startedAt) * simSpeed;
    const t = Math.min(1, elapsed / record.durationMs);
    return pointAlong(record.route, record.progression, t);
  },
}));
