import { create } from "zustand";
import type { Station } from "../models";
import { fetchStations } from "../data/dispatchApi";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface StationStore {
  stations: Station[];
  status: LoadStatus;
  error: string | null;
  load: () => Promise<void>;
}

export const useStationStore = create<StationStore>((set) => ({
  stations: [],
  status: "idle",
  error: null,
  load: async () => {
    set({ status: "loading", error: null });
    try {
      const stations = await fetchStations();
      set({ stations, status: "ready" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },
}));
