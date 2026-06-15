import { useEffect } from "react";
import { useIncidentStore } from "../stores/incidentStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { remainingResolveMs } from "../utils/resolve";
import { upgradeCheckDelayMs } from "../utils/assignment";
import { GAME_CONFIG } from "../config/gameConfig";

const TICK_MS = GAME_CONFIG.resolve.tickMs;

/**
 * Resolves calls whose on-scene work countdown has reached zero, and rolls
 * mandatory-response assignment upgrades for fully-staffed calls. Runs on a
 * single interval; reads sim-speed live so it tracks speed changes.
 */
export function useResolveTicker(): void {
  useEffect(() => {
    const id = window.setInterval(() => {
      const incidentStore = useIncidentStore.getState();
      const dispatchStore = useDispatchStore.getState();
      const incidents = incidentStore.incidents;
      const simSpeed = dispatchStore.simSpeed;
      const now = performance.now();
      for (const incident of incidents) {
        if (incident.status === "Resolved") {
          continue;
        }

        if (
          incident.resolveStartedAt != null &&
          remainingResolveMs(incident.resolveStartedAt, simSpeed, now) <= 0
        ) {
          dispatchStore.resolveCall(incident.id);
          continue;
        }

        if (
          incident.assignmentMetAt == null ||
          incident.nextUpgradeCheckAt == null ||
          now < incident.nextUpgradeCheckAt
        ) {
          continue;
        }

        const assignment = incidentStore.assignments.find(
          (a) => a.id === incident.assignmentId
        );
        if (!assignment?.upgradeTo) {
          continue;
        }

        if (Math.random() < assignment.upgradeProbability) {
          incidentStore.upgradeAssignment(incident.id, assignment.upgradeTo);
          dispatchStore.evaluateAssignment(incident.id);
        } else {
          incidentStore.setNextUpgradeCheck(
            incident.id,
            now + upgradeCheckDelayMs(simSpeed)
          );
        }
      }
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, []);
}
