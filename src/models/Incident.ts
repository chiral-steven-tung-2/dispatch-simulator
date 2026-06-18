import type { AssignmentRequirements } from "./Assignment";

export type IncidentStatus = "Waiting" | "Active" | "Resolved";

export interface Incident {
  id: string;
  name: string;
  /** performance.now() when the call was first created. Used for response-time metrics. */
  spawnedAt: number;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  /** Spawn category of the call type (e.g. "structure-normal-fire"). Used to filter modifiers. */
  callCategory: string;
  /** Current response-perimeter radius (m); grows as units arrive on scene. */
  radiusMeters: number;
  /** Maximum perimeter radius (m) — from the call type. Growth caps here. */
  maxRadiusMeters: number;
  /**
   * performance.now() timestamp when on-scene work began. Drives the resolve
   * countdown; undefined until a unit is working the call.
   */
  resolveStartedAt?: number;
  /** Id of the current mandatory-response assignment (e.g. "standard", "all_hands"). */
  assignmentId: string;
  /**
   * performance.now() timestamp when every unit required by the current
   * assignment was confirmed on scene. Gates the resolve countdown and
   * upgrade rolls; undefined until staffing is met.
   */
  assignmentMetAt?: number;
  /** performance.now() timestamp of the next upgrade-probability roll. */
  nextUpgradeCheckAt?: number;
  /** Ids of modifiers that have already fired for this incident. */
  activeModifiers: string[];
  /** Extra unit counts from "additional" modifiers — stacked on top of the alarm assignment. */
  extraRequirements: Partial<AssignmentRequirements>;
  /** Minimum unit counts from "required" modifiers — floor applied after assignment + extras. */
  requiredUnits: Partial<AssignmentRequirements>;
  /**
   * Randomised game-time (ms) this call takes to resolve once fully staffed.
   * Determined per assignment level when the resolve timer starts.
   */
  resolveTimeGameMs?: number;
  /** performance.now() timestamp when deferred modifier rolls should fire. */
  nextModifierCheckAt?: number;
  /** Assignment id whose modifiers are pending roll at nextModifierCheckAt. */
  modifierCheckAssignment?: string;
}
