import { create } from "zustand";
import type { Station } from "../models";
import { fetchStations, fetchNypdStations } from "../data/dispatchApi";

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
      const [fdnyStations, nypdStations] = await Promise.all([
        fetchStations(),
        fetchNypdStations(),
      ]);
      // Merge NYPD precincts into the unified station list so dispatch routing
      // (returnToQuarters) can look them up by id. Borough/battalion/division are
      // blank so FDNY call-spawning logic won't accidentally select them.
      const nypdAsStations: Station[] = nypdStations.map((s) => ({
        id: s.id,
        name: s.name,
        latitude: s.latitude,
        longitude: s.longitude,
        borough: "",
        battalion: "",
        division: "",
      }));
      set({ stations: [...fdnyStations, ...nypdAsStations], status: "ready" });
    } catch (err) {
      set({ status: "error", error: (err as Error).message });
    }
  },
}));
