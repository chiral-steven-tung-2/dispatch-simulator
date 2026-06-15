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
  toggleFdnyStations: () => void;
  toggleNypdStations: () => void;
  toggleChiefQuarters: () => void;
  toggleUnitIcons: () => void;
  toggleNotifications: () => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      showFdnyStations: true,
      showNypdStations: true,
      showChiefQuarters: true,
      showUnitIcons: true,
      showNotifications: true,
      toggleFdnyStations: () =>
        set((s) => ({ showFdnyStations: !s.showFdnyStations })),
      toggleNypdStations: () =>
        set((s) => ({ showNypdStations: !s.showNypdStations })),
      toggleChiefQuarters: () =>
        set((s) => ({ showChiefQuarters: !s.showChiefQuarters })),
      toggleUnitIcons: () => set((s) => ({ showUnitIcons: !s.showUnitIcons })),
      toggleNotifications: () =>
        set((s) => ({ showNotifications: !s.showNotifications })),
    }),
    { name: "nyc-dispatch:display" }
  )
);
