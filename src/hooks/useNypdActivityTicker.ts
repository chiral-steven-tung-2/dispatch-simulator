import { useEffect } from "react";
import { useNypdStationStore } from "../stores/nypdStationStore";
import { useNypdActivityStore } from "../stores/nypdActivityStore";
import { GAME_CONFIG } from "../config/gameConfig";

const TICK_MS = GAME_CONFIG.nypdPatrol.onAssignment.updateIntervalMs;

/**
 * Periodically re-rolls each precinct's simulated "On Assignment" fraction, so
 * the patrol status breakdown fluctuates over time like real call activity.
 */
export function useNypdActivityTicker(): void {
  useEffect(() => {
    const tick = () => {
      const stations = useNypdStationStore.getState().stations;
      const roll = useNypdActivityStore.getState().roll;
      for (const station of stations) {
        roll(station.id);
      }
    };

    // Seed initial values immediately so popups have data before the first tick.
    tick();

    const id = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(id);
  }, []);
}
