import { useEffect } from "react";
import { useIncidentStore } from "../stores/incidentStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { remainingResolveMs } from "../utils/resolve";

const TICK_MS = 250;

/**
 * Resolves calls whose on-scene work countdown has reached zero. Runs on a
 * single interval; reads sim-speed live so it tracks speed changes.
 */
export function useResolveTicker(): void {
  useEffect(() => {
    const id = window.setInterval(() => {
      const incidents = useIncidentStore.getState().incidents;
      const simSpeed = useDispatchStore.getState().simSpeed;
      const now = performance.now();
      for (const incident of incidents) {
        if (incident.resolveStartedAt == null || incident.status === "Resolved") {
          continue;
        }
        if (remainingResolveMs(incident.resolveStartedAt, simSpeed, now) <= 0) {
          useDispatchStore.getState().resolveCall(incident.id);
        }
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, []);
}
