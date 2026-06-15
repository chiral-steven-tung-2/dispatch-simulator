import { useEffect } from "react";
import { useDispatchStore } from "../stores/dispatchStore";
import { useIncidentStore } from "../stores/incidentStore";
import { useUnitStore } from "../stores/unitStore";
import { useStationStore } from "../stores/stationStore";
import { haversineMeters, type LngLat } from "../utils/geo";
import {
  REQUIREMENT_KEYS,
  UNIT_TYPE_CATEGORY,
  countOnSceneByCategory,
} from "../utils/assignment";
import { GAME_CONFIG } from "../config/gameConfig";
import type { Unit } from "../models";

const CHECK_INTERVAL_MS = GAME_CONFIG.autoDispatch.checkIntervalMs;

/**
 * When auto-dispatch is enabled, automatically sends the nearest available
 * units to any call whose current assignment isn't yet fully staffed —
 * including additional units needed after an assignment upgrade. Lets the
 * simulator run hands-free.
 */
export function useAutoDispatcher(): void {
  useEffect(() => {
    const id = window.setInterval(() => {
      const dispatchStore = useDispatchStore.getState();
      if (!dispatchStore.autoDispatch || dispatchStore.dispatching) {
        return;
      }

      const incidentStore = useIncidentStore.getState();
      const units = useUnitStore.getState().units;
      const stations = useStationStore.getState().stations;

      for (const incident of incidentStore.incidents) {
        if (incident.status === "Resolved") {
          continue;
        }
        const assignment = incidentStore.assignments.find(
          (a) => a.id === incident.assignmentId
        );
        if (!assignment) {
          continue;
        }

        const committed = dispatchStore.dispatches.filter(
          (d) =>
            d.callId === incident.id &&
            (d.phase === "dispatched" ||
              d.phase === "enroute" ||
              d.phase === "onScene")
        );
        const counts = countOnSceneByCategory(committed);

        const target: LngLat = [incident.longitude, incident.latitude];
        const toDispatch: Unit[] = [];

        for (const key of REQUIREMENT_KEYS) {
          let need = assignment[key] - (counts[key] ?? 0);
          if (need <= 0) {
            continue;
          }

          const candidates = units
            .filter(
              (u) =>
                u.status === "Available" &&
                UNIT_TYPE_CATEGORY[u.type] === key &&
                !toDispatch.some((picked) => picked.id === u.id)
            )
            .map((u) => {
              const station = stations.find((s) => s.id === u.stationId);
              const distance = station
                ? haversineMeters(
                    [station.longitude, station.latitude],
                    target
                  )
                : Infinity;
              return { unit: u, distance };
            })
            .sort((a, b) => a.distance - b.distance);

          for (const { unit } of candidates) {
            if (need <= 0) {
              break;
            }
            toDispatch.push(unit);
            need--;
          }
        }

        if (toDispatch.length > 0) {
          void dispatchStore.dispatchUnits(incident, toDispatch);
          return;
        }
      }
    }, CHECK_INTERVAL_MS);

    return () => window.clearInterval(id);
  }, []);
}
