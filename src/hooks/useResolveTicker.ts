import { useEffect } from "react";
import { useIncidentStore } from "../stores/incidentStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { remainingResolveMs } from "../utils/resolve";
import { upgradeCheckDelayMs } from "../utils/assignment";
import { GAME_CONFIG, randomModifierCheckDelayMs } from "../config/gameConfig";

const TICK_MS = GAME_CONFIG.resolve.tickMs;

/**
 * Resolves calls whose on-scene work countdown has reached zero, rolls
 * mandatory-response assignment upgrades for fully-staffed calls, and fires
 * deferred modifier checks. Runs on a single interval; reads sim-speed live.
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

        // Resolve the call if the on-scene timer has run out.
        if (
          incident.resolveStartedAt != null &&
          remainingResolveMs(incident.resolveStartedAt, simSpeed, incident.resolveTimeGameMs, now) <= 0
        ) {
          dispatchStore.resolveCall(incident.id);
          continue;
        }

        // Fire deferred modifier rolls when their delay has elapsed.
        if (
          incident.nextModifierCheckAt != null &&
          now >= incident.nextModifierCheckAt &&
          incident.modifierCheckAssignment != null
        ) {
          incidentStore.clearModifierCheck(incident.id);
          const eligible = incidentStore.modifiers.filter(
            (m) =>
              m.triggerAssignment === incident.modifierCheckAssignment &&
              (m.callCategories.length === 0 || m.callCategories.includes(incident.callCategory)) &&
              !incident.activeModifiers.includes(m.id)
          );
          let activeCount = incident.activeModifiers.length;
          for (const modifier of eligible) {
            if (activeCount >= 3) break;
            if (Math.random() < modifier.probability) {
              incidentStore.applyModifier(incident.id, modifier.id);
              activeCount++;
            }
          }
          // Modifier requirements changed — re-evaluate whether the assignment is still staffed.
          dispatchStore.evaluateAssignment(incident.id);
        }

        // Upgrade-probability roll.
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
          // Schedule a deferred modifier roll for the new alarm level.
          // setModifierCheck is a no-op if a check is already pending.
          incidentStore.setModifierCheck(
            incident.id,
            now + randomModifierCheckDelayMs(simSpeed),
            assignment.upgradeTo
          );
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
