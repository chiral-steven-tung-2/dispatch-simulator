import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Assignment, CallSpawnCategory, CallType, Incident, IncidentStatus, Modifier } from "../models";
import { fetchAssignments, fetchCallSpawnCategories, fetchCallTypes, fetchModifiers } from "../data/dispatchApi";
import { makeRandomCall } from "../utils/spawn";
import { REQUIREMENT_KEYS } from "../utils/assignment";
import { useStationStore } from "./stationStore";
import { useSettingsStore } from "./settingsStore";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface IncidentStore {
  /** Live calls — generated at runtime, not loaded from the backend. */
  incidents: Incident[];
  notifications: CallNotification[];
  /** Resolved calls this session — used by the history panel. */
  callHistory: CallHistoryEntry[];
  /** Catalog of call types loaded from the backend. */
  callTypes: CallType[];
  /** Spawn-category probabilities loaded from the backend. */
  callSpawnCategories: CallSpawnCategory[];
  /** Catalog of mandatory-response assignments and their escalation chain. */
  assignments: Assignment[];
  /** Scene modifiers that can be special-called as a fire escalates. */
  modifiers: Modifier[];
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
  startResolveTimer: (incidentId: string, resolveTimeGameMs: number) => void;
  /** Stop a call's resolve countdown (e.g. its on-scene units were recalled). */
  clearResolveTimer: (incidentId: string) => void;
  /** Switch a call to a new mandatory-response assignment and notify the dispatcher. */
  upgradeAssignment: (incidentId: string, assignmentId: string) => void;
  /** Record that the current assignment's required units are all on scene (or clear it). */
  setAssignmentMet: (incidentId: string, met: boolean) => void;
  /** Schedule (or clear) the next upgrade-probability roll. */
  setNextUpgradeCheck: (incidentId: string, at: number | undefined) => void;
  /** Schedule a deferred modifier roll for a specific assignment level. No-op if one is already pending. */
  setModifierCheck: (incidentId: string, at: number, assignmentId: string) => void;
  /** Clear a pending modifier check (e.g. after it fires). */
  clearModifierCheck: (incidentId: string) => void;
  /** Keep resolve and upgrade-check countdowns continuous across a sim-speed change. */
  rebaseTimers: (ratio: number) => void;
  /** Apply a modifier to an incident, adding its extra unit requirements and notifying the dispatcher. */
  applyModifier: (incidentId: string, modifierId: string) => void;
  /** Record a resolved call in the session history. */
  addCallToHistory: (entry: CallHistoryEntry) => void;
}

export interface CallNotification {
  id: string;
  callId: string;
  title: string;
  status: IncidentStatus;
  kind: "new" | "upgrade" | "modifier";
  latitude: number;
  longitude: number;
  createdAt: number;
}

export interface CallHistoryEntry {
  id: string;
  name: string;
  finalAssignmentId: string;
  spawnedAt: number;
  resolvedAt: number;
  totalUnits: number;
}

export const useIncidentStore = create<IncidentStore>()(
  persist(
    (set, get) => ({
  incidents: [],
  notifications: [],
  callHistory: [],
  callTypes: [],
  callSpawnCategories: [],
  assignments: [],
  modifiers: [],
  status: "idle",
  error: null,
  autoSpawn: false,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const [callTypes, callSpawnCategories, assignments, modifiers] = await Promise.all([
        fetchCallTypes(),
        fetchCallSpawnCategories(),
        fetchAssignments(),
        fetchModifiers(),
      ]);
      set({ callTypes, callSpawnCategories, assignments, modifiers, status: "ready" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },

  spawnCall: () => {
    const { callTypes, callSpawnCategories } = get();
    const callMode = useSettingsStore.getState().callMode;
    const stations = useStationStore.getState().stations;
    if (callTypes.length === 0 || stations.length === 0) {
      return;
    }
    const isNypdCall = (type: CallType) => type.assignmentId.startsWith("nypd_");
    const isEnabledForMode = (type: CallType) =>
      callMode === "all" ||
      (callMode === "fdny" && !isNypdCall(type)) ||
      (callMode === "nypd" && isNypdCall(type));
    const filteredTypes = callTypes.filter(isEnabledForMode);
    if (filteredTypes.length === 0) {
      return;
    }
    const filteredCategories = callSpawnCategories.filter((category) =>
      filteredTypes.some((type) => type.category === category.category)
    );
    const call = makeRandomCall(filteredTypes, filteredCategories, stations);
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

  startResolveTimer: (incidentId, resolveTimeGameMs) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId && i.resolveStartedAt == null
          ? { ...i, resolveStartedAt: performance.now(), resolveTimeGameMs }
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
              resolveTimeGameMs: undefined,
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

  setModifierCheck: (incidentId, at, assignmentId) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId && i.nextModifierCheckAt == null
          ? { ...i, nextModifierCheckAt: at, modifierCheckAssignment: assignmentId }
          : i
      ),
    })),

  clearModifierCheck: (incidentId) =>
    set((state) => ({
      incidents: state.incidents.map((i) =>
        i.id === incidentId
          ? { ...i, nextModifierCheckAt: undefined, modifierCheckAssignment: undefined }
          : i
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
          nextModifierCheckAt:
            i.nextModifierCheckAt == null
              ? i.nextModifierCheckAt
              : rebase(i.nextModifierCheckAt),
        })),
      };
    }),

  applyModifier: (incidentId, modifierId) => {
    const state = get();
    const modifier = state.modifiers.find((m) => m.id === modifierId);
    const incident = state.incidents.find((i) => i.id === incidentId);
    if (!modifier || !incident) {
      return;
    }
    const notification: CallNotification = {
      id: `modifier-${incidentId}-${modifierId}-${Math.random().toString(36).slice(2, 7)}`,
      callId: incidentId,
      title: `${incident.name}: ${modifier.name}`,
      status: incident.status,
      kind: "modifier",
      latitude: incident.latitude,
      longitude: incident.longitude,
      createdAt: performance.now(),
    };
    set((s) => ({
      incidents: s.incidents.map((i) => {
        if (i.id !== incidentId) {
          return i;
        }
        const extra = { ...i.extraRequirements };
        const req = { ...i.requiredUnits };
        for (const key of REQUIREMENT_KEYS) {
          const count = modifier[key];
          if (count <= 0) continue;
          if (modifier.modifierType === "required") {
            req[key] = Math.max(req[key] ?? 0, count);
          } else {
            extra[key] = (extra[key] ?? 0) + count;
          }
        }
        return {
          ...i,
          activeModifiers: [...i.activeModifiers, modifierId],
          extraRequirements: extra,
          requiredUnits: req,
        };
      }),
      notifications: [notification, ...s.notifications].slice(0, 5),
    }));
  },
  addCallToHistory: (entry) =>
    set((state) => ({
      callHistory: [entry, ...state.callHistory].slice(0, 100),
    })),

    }),
    {
      name: "nyc-dispatch:incidents",
      partialize: (state) => ({ autoSpawn: state.autoSpawn }),
    }
  )
);
