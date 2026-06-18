import { create } from "zustand";
import type { Unit, UnitStatus } from "../models";
import { fetchUnits, fetchNypdVehicles } from "../data/dispatchApi";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface UnitStore {
  units: Unit[];
  status: LoadStatus;
  error: string | null;
  load: () => Promise<void>;
  setUnitStatus: (unitId: string, status: UnitStatus) => void;
  /** Marks a unit as having arrived (and parked) at the given station. */
  arriveAtStation: (unitId: string, stationId: string) => void;
}

export const useUnitStore = create<UnitStore>((set) => ({
  units: [],
  status: "idle",
  error: null,
  load: async () => {
    set({ status: "loading", error: null });
    try {
      const [fdnyVehicles, nypdVehicles] = await Promise.all([
        fetchUnits(),
        fetchNypdVehicles(),
      ]);

      const fdnyUnits: Unit[] = fdnyVehicles.map((unit) => ({
        ...unit,
        currentStationId: unit.stationId,
      }));

      const nypdUnits: Unit[] = nypdVehicles.map((v) => ({
        id: v.id,
        callsign: v.callsign,
        type: v.type,
        status: v.status as UnitStatus,
        stationId: v.stationId,
        currentStationId: v.stationId,
        ffCount: v.ffCount,
      }));

      set({ units: [...fdnyUnits, ...nypdUnits], status: "ready" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },
  setUnitStatus: (unitId, status) =>
    set((state) => ({
      units: state.units.map((unit) =>
        unit.id === unitId ? { ...unit, status } : unit
      ),
    })),
  arriveAtStation: (unitId, stationId) =>
    set((state) => ({
      units: state.units.map((unit) =>
        unit.id === unitId
          ? { ...unit, currentStationId: stationId, status: "Available" }
          : unit
      ),
    })),
}));
