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
  showChiefQuarters: boolean;
  showUnitIcons: boolean;
  showNotifications: boolean;
  showPrecinctBoundaries: boolean;
  showFireVehicles: boolean;
  showPoliceVehicles: boolean;
  /** Global target % (0-100) of each precinct's patrol fleet that should be on patrol. */
  patrolPercent: number;
  /** Scale multiplier for station / precinct map markers (0.5 – 2.0). */
  markerScale: number;
  toggleFdnyStations: () => void;
  toggleNypdStations: () => void;
  toggleChiefQuarters: () => void;
  toggleUnitIcons: () => void;
  toggleNotifications: () => void;
  togglePrecinctBoundaries: () => void;
  toggleFireVehicles: () => void;
  togglePoliceVehicles: () => void;
  setPatrolPercent: (percent: number) => void;
  setMarkerScale: (scale: number) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showFdnyStations: true,
      showNypdStations: true,
      showChiefQuarters: true,
      showUnitIcons: true,
      showNotifications: true,
      showPrecinctBoundaries: true,
      showFireVehicles: true,
      showPoliceVehicles: true,
      patrolPercent: 50,
      markerScale: 1,
      toggleFdnyStations: () =>
        set((s) => ({ showFdnyStations: !s.showFdnyStations })),
      toggleNypdStations: () =>
        set((s) => ({ showNypdStations: !s.showNypdStations })),
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
      setPatrolPercent: (percent) =>
        set({ patrolPercent: Math.min(100, Math.max(0, percent)) }),
      setMarkerScale: (scale) =>
        set({ markerScale: Math.min(2, Math.max(0.5, scale)) }),
    }),
    { name: "nyc-dispatch:display" }
  )
);
