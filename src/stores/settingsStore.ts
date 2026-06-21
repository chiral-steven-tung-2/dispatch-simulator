import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * User display preferences that persist across page reloads (map layer
 * visibility and notification toasts). Gameplay/simulation controls
 * (auto-spawn, auto-dispatch, paths, sim speed) live in their own stores and
 * are persisted there.
 */
interface SettingsStore {
  showFdnyStations: boolean;
  showNypdStations: boolean;
  callMode: "all" | "fdny" | "nypd";
  showChiefQuarters: boolean;
  showUnitIcons: boolean;
  showNotifications: boolean;
  showPrecinctBoundaries: boolean;
  showFireVehicles: boolean;
  showPoliceVehicles: boolean;
  /** Scale multiplier for station / precinct map markers (0.5 – 2.0). */
  markerScale: number;
  /** Fraction of each precinct's assigned patrol cars that actively patrol (0–1). */
  patrolRatio: number;
  toggleFdnyStations: () => void;
  toggleNypdStations: () => void;
  setCallMode: (mode: "all" | "fdny" | "nypd") => void;
  toggleChiefQuarters: () => void;
  toggleUnitIcons: () => void;
  toggleNotifications: () => void;
  togglePrecinctBoundaries: () => void;
  toggleFireVehicles: () => void;
  togglePoliceVehicles: () => void;
  setMarkerScale: (scale: number) => void;
  setPatrolRatio: (ratio: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showFdnyStations: true,
      showNypdStations: true,
      callMode: "all",
      showChiefQuarters: true,
      showUnitIcons: true,
      showNotifications: true,
      showPrecinctBoundaries: true,
      showFireVehicles: true,
      showPoliceVehicles: true,
      markerScale: 1,
      patrolRatio: 0.2,
      toggleFdnyStations: () =>
        set((s) => ({ showFdnyStations: !s.showFdnyStations })),
      toggleNypdStations: () =>
        set((s) => ({ showNypdStations: !s.showNypdStations })),
      setCallMode: (mode) => set({ callMode: mode }),
      toggleChiefQuarters: () =>
        set((s) => ({ showChiefQuarters: !s.showChiefQuarters })),
      toggleUnitIcons: () => set((s) => ({ showUnitIcons: !s.showUnitIcons })),
      toggleNotifications: () =>
        set((s) => ({ showNotifications: !s.showNotifications })),
      togglePrecinctBoundaries: () =>
        set((s) => ({ showPrecinctBoundaries: !s.showPrecinctBoundaries })),
      toggleFireVehicles: () =>
        set((s) => ({ showFireVehicles: !s.showFireVehicles })),
      togglePoliceVehicles: () =>
        set((s) => ({ showPoliceVehicles: !s.showPoliceVehicles })),
      setMarkerScale: (scale) =>
        set({ markerScale: Math.min(2, Math.max(0.5, scale)) }),
      setPatrolRatio: (ratio) =>
        set({ patrolRatio: Math.min(1, Math.max(0, ratio)) }),
    }),
    { name: "nyc-dispatch:display" }
  )
);
