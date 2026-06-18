import { useEffect } from "react";
import {
  useDispatchStore,
  dispatchCurrentPoint,
  type DispatchRecord,
} from "../stores/dispatchStore";
import { useIncidentStore } from "../stores/incidentStore";
import { useUnitStore } from "../stores/unitStore";
import { useStationStore } from "../stores/stationStore";
import { useRelocationStore, relocationCurrentPoint, type RelocationRecord } from "../stores/relocationStore";
import { haversineMeters, type LngLat } from "../utils/geo";
import {
  REQUIREMENT_KEYS,
  UNIT_TYPE_CATEGORY,
  countOnSceneByCategory,
  effectiveNeed,
} from "../utils/assignment";
import { GAME_CONFIG } from "../config/gameConfig";
import { usePatrolStore } from "../stores/patrolStore";
import type { Unit, Station } from "../models";
import type { AssignmentRequirements } from "../models";

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
      const relocations = useRelocationStore.getState().relocations;
      const { dispatches, simSpeed } = dispatchStore;

      // ── Pre-build lookup maps (O(n) once per tick) ──────────────────────────

      const dispatchByUnit = new Map<string, DispatchRecord>();
      for (const d of dispatches) dispatchByUnit.set(d.unitId, d);

      const relocationByUnit = new Map<string, RelocationRecord>();
      for (const r of relocations) relocationByUnit.set(r.unitId, r);

      const stationById = new Map<string, Station>();
      for (const s of stations) stationById.set(s.id, s);

      const assignmentById = new Map(
        incidentStore.assignments.map((a) => [a.id, a])
      );

      // Dispatches committed to a call (counting toward staffing).
      const committedByCall = new Map<string, DispatchRecord[]>();
      for (const d of dispatches) {
        if (
          d.phase === "dispatched" ||
          d.phase === "enroute" ||
          d.phase === "onScene"
        ) {
          const list = committedByCall.get(d.callId);
          if (list) list.push(d);
          else committedByCall.set(d.callId, [d]);
        }
      }

      // Compute every unit's dispatchable origin once.
      const origins = new Map<string, LngLat>();
      for (const unit of units) {
        const dispatch = dispatchByUnit.get(unit.id);
        if (dispatch) {
          // Only units returning to quarters can be re-dispatched.
          if (dispatch.phase === "returning") {
            origins.set(unit.id, dispatchCurrentPoint(dispatch, simSpeed));
          }
          continue;
        }
        const relocation = relocationByUnit.get(unit.id);
        if (relocation) {
          origins.set(unit.id, relocationCurrentPoint(relocation, simSpeed));
          continue;
        }
        if (unit.status === "Available") {
          const patrolPos = usePatrolStore.getState().getCurrentPoint(unit.id, simSpeed);
          if (patrolPos) {
            origins.set(unit.id, patrolPos);
          } else {
            const station = stationById.get(unit.currentStationId);
            if (station) origins.set(unit.id, [station.longitude, station.latitude]);
          }
        }
      }

      // Group available units by requirement category.
      const byCategory = new Map<keyof AssignmentRequirements, Unit[]>();
      for (const unit of units) {
        if (!origins.has(unit.id)) continue;
        const key = UNIT_TYPE_CATEGORY[unit.type] as keyof AssignmentRequirements | undefined;
        if (!key) continue;
        const list = byCategory.get(key);
        if (list) list.push(unit);
        else byCategory.set(key, [unit]);
      }

      // ── Per-incident dispatch loop ───────────────────────────────────────────

      for (const incident of incidentStore.incidents) {
        if (incident.status === "Resolved") continue;

        const assignment = assignmentById.get(incident.assignmentId);
        if (!assignment) continue;

        const committed = committedByCall.get(incident.id) ?? [];
        const counts = countOnSceneByCategory(committed);
        const target: LngLat = [incident.longitude, incident.latitude];
        const toDispatch: Unit[] = [];
        const pickedIds = new Set<string>();

        for (const key of REQUIREMENT_KEYS) {
          let need =
            effectiveNeed(assignment, key, incident.extraRequirements, incident.requiredUnits) -
            (counts[key] ?? 0);
          if (need <= 0) continue;

          const candidates = (byCategory.get(key) ?? [])
            .filter((u) => !pickedIds.has(u.id))
            .map((u) => ({
              unit: u,
              distance: haversineMeters(origins.get(u.id)!, target),
            }))
            .sort((a, b) => a.distance - b.distance);

          for (const { unit } of candidates) {
            if (need <= 0) break;
            toDispatch.push(unit);
            pickedIds.add(unit.id);
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
