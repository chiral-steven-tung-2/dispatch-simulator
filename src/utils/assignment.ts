import type { Assignment, AssignmentRequirements } from "../models";
import type { DispatchRecord } from "../stores/dispatchStore";
import { GAME_CONFIG } from "../config/gameConfig";

/** Maps a unit's `type` (from the vehicle roster) to its assignment-requirement category. */
export const UNIT_TYPE_CATEGORY: Record<string, keyof AssignmentRequirements> = {
  Engine: "engines",
  "Tower Ladder": "trucks",
  "Rear Mount": "trucks",
  "Tractor Trailor": "trucks",
  Rescue: "rescues",
  Squad: "squads",
  Battalion: "battalions",
  Division: "divisions",
  RAC: "rac",
  Satellite: "satellite",
  TSU: "tsu",
  HazMat: "hazmat",
};

export const REQUIREMENT_KEYS = Object.keys({
  engines: 0,
  trucks: 0,
  rescues: 0,
  squads: 0,
  battalions: 0,
  divisions: 0,
  rac: 0,
  satellite: 0,
  tsu: 0,
  hazmat: 0,
} satisfies AssignmentRequirements) as (keyof AssignmentRequirements)[];

/** Display labels for each assignment-requirement category. */
export const CATEGORY_LABELS: Record<keyof AssignmentRequirements, string> = {
  engines: "Engines",
  trucks: "Trucks",
  rescues: "Rescues",
  squads: "Squads",
  battalions: "Battalions",
  divisions: "Divisions",
  rac: "RAC",
  satellite: "Satellite",
  tsu: "TSU",
  hazmat: "HazMat",
};

/** Counts on-scene units by assignment-requirement category. */
export function countOnSceneByCategory(
  onSceneUnits: DispatchRecord[]
): Partial<Record<keyof AssignmentRequirements, number>> {
  const counts: Partial<Record<keyof AssignmentRequirements, number>> = {};
  for (const unit of onSceneUnits) {
    const category = UNIT_TYPE_CATEGORY[unit.type];
    if (!category) {
      continue;
    }
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}

/** Real ms until the next upgrade-probability roll, given the current sim-speed. */
export function upgradeCheckDelayMs(simSpeed: number): number {
  return GAME_CONFIG.upgrade.checkIntervalGameMs / simSpeed;
}

/** True if every unit category required by `assignment` is met by the on-scene units. */
export function isAssignmentStaffed(
  assignment: Assignment,
  onSceneUnits: DispatchRecord[]
): boolean {
  const counts = countOnSceneByCategory(onSceneUnits);
  return REQUIREMENT_KEYS.every(
    (key) => (counts[key] ?? 0) >= assignment[key]
  );
}
