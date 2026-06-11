import { create } from "zustand";
import type { CallType, Incident, IncidentStatus } from "../models";
import { fetchCallTypes } from "../data/dispatchApi";
import { makeRandomCall } from "../utils/spawn";
import { useStationStore } from "./stationStore";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface IncidentStore {
  /** Live calls — generated at runtime, not loaded from the backend. */
  incidents: Incident[];
  /** Catalog of call types (with spawn weights) loaded from the backend. */
  callTypes: CallType[];
  status: LoadStatus;
  error: string | null;
  autoSpawn: boolean;

  load: () => Promise<void>;
  spawnCall: () => void;
  toggleAutoSpawn: () => void;
  setIncidentStatus: (incidentId: string, status: IncidentStatus) => void;
  removeIncident: (incidentId: string) => void;
  /** Set a call's current perimeter radius (grows as units arrive). */
  setCallRadius: (incidentId: string, radiusMeters: number) => void;
  /** Start the on-scene work clock for a call (no-op if already running). */
  startResolveTimer: (incidentId: string) => void;
  /** Stop a call's resolve countdown (e.g. its on-scene units were recalled). */
  clearResolveTimer: (incidentId: string) => void;
  /** Keep resolve countdowns continuous across a sim-speed change. */
  rebaseResolveTimers: (ratio: number) => void;
}

export const useIncidentStore = create<IncidentStore>((set, get) => ({
  incidents: [],
  callTypes: [],
  status: "idle",
  error: null,
  autoSpawn: false,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const callTypes = await fetchCallTypes();
      set({ callTypes, status: "ready" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },

  spawnCall: () => {
    const callTypes = get().callTypes;
    const stations = useStationStore.getState().stations;
    if (callTypes.length === 0 || stations.length === 0) {
      return;
    }
    const call = makeRandomCall(callTypes, stations);
    set((state) => ({ incidents: [...state.incidents, call] }));
  },

  toggleAutoSpawn: () => set((state) => ({ autoSpawn: !state.autoSpawn })),

  setIncidentStatus: (incidentId, status) =>
    set((state) => ({
      incidents: state.incidents.map((incident) =>
        incident.id === incidentId ? { ...incident, status } : incident
      ),
    })),

  removeIncident: (incidentId) =>
    set((state) => ({
      incidents: state.incidents.filter((i) => i.id !== incidentId),
    })),

  setCallRadius: (incidentId, radiusMeters) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId ? { ...i, radiusMeters } : i
      ),
    })),

  startResolveTimer: (incidentId) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId && i.resolveStartedAt == null
          ? { ...i, resolveStartedAt: performance.now() }
          : i
      ),
    })),

  clearResolveTimer: (incidentId) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId ? { ...i, resolveStartedAt: undefined } : i
      ),
    })),

  rebaseResolveTimers: (ratio) =>
    set((state) => {
      const now = performance.now();
      return {
        incidents: state.incidents.map((i) =>
          i.resolveStartedAt == null
            ? i
            : { ...i, resolveStartedAt: now - (now - i.resolveStartedAt) * ratio }
        ),
      };
    }),
}));
