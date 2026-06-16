import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Assignment, CallSpawnCategory, CallType, Incident, IncidentStatus } from "../models";
import { fetchAssignments, fetchCallSpawnCategories, fetchCallTypes } from "../data/dispatchApi";
import { makeRandomCall } from "../utils/spawn";
import { useStationStore } from "./stationStore";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface IncidentStore {
  /** Live calls — generated at runtime, not loaded from the backend. */
  incidents: Incident[];
  notifications: CallNotification[];
  /** Catalog of call types loaded from the backend. */
  callTypes: CallType[];
  /** Spawn-category probabilities loaded from the backend. */
  callSpawnCategories: CallSpawnCategory[];
  /** Catalog of mandatory-response assignments and their escalation chain. */
  assignments: Assignment[];
  status: LoadStatus;
  error: string | null;
  autoSpawn: boolean;

  load: () => Promise<void>;
  spawnCall: () => void;
  toggleAutoSpawn: () => void;
  dismissNotification: (notificationId: string) => void;
  setIncidentStatus: (incidentId: string, status: IncidentStatus) => void;
  removeIncident: (incidentId: string) => void;
  /** Set a call's current perimeter radius (grows as units arrive). */
  setCallRadius: (incidentId: string, radiusMeters: number) => void;
  /** Start the on-scene work clock for a call (no-op if already running). */
  startResolveTimer: (incidentId: string) => void;
  /** Stop a call's resolve countdown (e.g. its on-scene units were recalled). */
  clearResolveTimer: (incidentId: string) => void;
  /** Switch a call to a new mandatory-response assignment and notify the dispatcher. */
  upgradeAssignment: (incidentId: string, assignmentId: string) => void;
  /** Record that the current assignment's required units are all on scene (or clear it). */
  setAssignmentMet: (incidentId: string, met: boolean) => void;
  /** Schedule (or clear) the next upgrade-probability roll. */
  setNextUpgradeCheck: (incidentId: string, at: number | undefined) => void;
  /** Keep resolve and upgrade-check countdowns continuous across a sim-speed change. */
  rebaseTimers: (ratio: number) => void;
}

interface CallNotification {
  id: string;
  callId: string;
  title: string;
  status: IncidentStatus;
  kind: "new" | "upgrade";
  latitude: number;
  longitude: number;
  createdAt: number;
}

export const useIncidentStore = create<IncidentStore>()(
  persist(
    (set, get) => ({
  incidents: [],
  notifications: [],
  callTypes: [],
  callSpawnCategories: [],
  assignments: [],
  status: "idle",
  error: null,
  autoSpawn: false,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const [callTypes, callSpawnCategories, assignments] = await Promise.all([
        fetchCallTypes(),
        fetchCallSpawnCategories(),
        fetchAssignments(),
      ]);
      set({ callTypes, callSpawnCategories, assignments, status: "ready" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },

  spawnCall: () => {
    const { callTypes, callSpawnCategories } = get();
    const stations = useStationStore.getState().stations;
    if (callTypes.length === 0 || stations.length === 0) {
      return;
    }
    const call = makeRandomCall(callTypes, callSpawnCategories, stations);
    const notification: CallNotification = {
      id: `call-notification-${call.id}`,
      callId: call.id,
      title: call.name,
      status: call.status,
      kind: "new",
      latitude: call.latitude,
      longitude: call.longitude,
      createdAt: performance.now(),
    };
    set((state) => ({
      incidents: [...state.incidents, call],
      notifications: [notification, ...state.notifications].slice(0, 5),
    }));
  },

  toggleAutoSpawn: () => set((state) => ({ autoSpawn: !state.autoSpawn })),

  dismissNotification: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== notificationId),
    })),

  setIncidentStatus: (incidentId, status) =>
    set((state) => ({
      incidents: state.incidents.map((incident) =>
        incident.id === incidentId ? { ...incident, status } : incident
      ),
    })),

  removeIncident: (incidentId) =>
    set((state) => ({
      incidents: state.incidents.filter((i) => i.id !== incidentId),
      notifications: state.notifications.filter((n) => n.callId !== incidentId),
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

  upgradeAssignment: (incidentId, assignmentId) => {
    const state = get();
    const incident = state.incidents.find((i) => i.id === incidentId);
    const assignment = state.assignments.find((a) => a.id === assignmentId);
    if (!incident || !assignment) {
      return;
    }
    const notification: CallNotification = {
      id: `call-upgrade-${incidentId}-${assignmentId}-${Math.random().toString(36).slice(2, 7)}`,
      callId: incidentId,
      title: `${incident.name} upgraded to ${assignment.name}`,
      status: incident.status,
      kind: "upgrade",
      latitude: incident.latitude,
      longitude: incident.longitude,
      createdAt: performance.now(),
    };
    set((s) => ({
      incidents: s.incidents.map((i) =>
        i.id === incidentId
          ? {
              ...i,
              assignmentId,
              assignmentMetAt: undefined,
              nextUpgradeCheckAt: undefined,
              resolveStartedAt: undefined,
            }
          : i
      ),
      notifications: [notification, ...s.notifications].slice(0, 5),
    }));
  },

  setAssignmentMet: (incidentId, met) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId
          ? { ...i, assignmentMetAt: met ? performance.now() : undefined }
          : i
      ),
    })),

  setNextUpgradeCheck: (incidentId, at) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId ? { ...i, nextUpgradeCheckAt: at } : i
      ),
    })),

  rebaseTimers: (ratio) =>
    set((state) => {
      const now = performance.now();
      const rebase = (t: number) => now - (now - t) * ratio;
      return {
        incidents: state.incidents.map((i) => ({
          ...i,
          resolveStartedAt:
            i.resolveStartedAt == null ? i.resolveStartedAt : rebase(i.resolveStartedAt),
          assignmentMetAt:
            i.assignmentMetAt == null ? i.assignmentMetAt : rebase(i.assignmentMetAt),
          nextUpgradeCheckAt:
            i.nextUpgradeCheckAt == null
              ? i.nextUpgradeCheckAt
              : rebase(i.nextUpgradeCheckAt),
        })),
      };
    }),
    }),
    {
      name: "nyc-dispatch:incidents",
      partialize: (state) => ({ autoSpawn: state.autoSpawn }),
    }
  )
);
