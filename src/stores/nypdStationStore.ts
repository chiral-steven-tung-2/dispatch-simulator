import { create } from "zustand";
import type { NypdStation } from "../models";
import { fetchNypdStations } from "../data/dispatchApi";

type LoadStatus = "idle" | "loading" | "ready" | "error";

interface NypdStationStore {
  stations: NypdStation[];
  status: LoadStatus;
  error: string | null;
  load: () => Promise<void>;
}

export const useNypdStationStore = create<NypdStationStore>((set) => ({
  stations: [],
  status: "idle",
  error: null,
  load: async () => {
    set({ status: "loading", error: null });
    try {
      const stations = await fetchNypdStations();
      set({ stations, status: "ready" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },
}));