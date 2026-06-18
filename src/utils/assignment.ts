import type { Assignment, AssignmentRequirements } from "../models";
import type { DispatchRecord } from "../stores/dispatchStore";
import { GAME_CONFIG } from "../config/gameConfig";

/** Maps a unit's `type` (from the vehicle roster) to its assignment-requirement category. */
export const UNIT_TYPE_CATEGORY: Record<string, keyof AssignmentRequirements> = {
  Engine: "engine",
  "Tower Ladder": "ladder",
  "Rear Mount": "ladder",
  "Tractor Trailor": "ladder",
  Rescue: "rescue",
  Squad: "squad",
  Squad2: "squad2piece",
  Battalion: "battalion",
  Division: "division",
  RAC: "rac",
  Satellite: "satellite",
  TSU: "tsu",
  MSU: "msu",
  "Field Comm.": "fieldcomm",
  MCP: "mcp",
  HazMat: "hazmat",
  HTMU: "htmu",
  "HazMat Support": "hazmatsupport",
  "Battalion HazMat": "hazmatbattalion",
  "Battalion Rescue": "rescuebattalion",
  "Battalion Safety": "safetybattalion",
  Brush: "brush",
  Collapse: "collapse",
  "Purple-K": "purplek",
  IMT: "imt",
  "High Rise": "highrise",
  "Thawing Apparatus": "thawing",
  "Patrol Car": "patrolCar",
};

export const REQUIREMENT_KEYS = Object.keys({
  engine: 0,
  ladder: 0,
  rescue: 0,
  squad: 0,
  squad2piece: 0,
  battalion: 0,
  division: 0,
  rac: 0,
  satellite: 0,
  tsu: 0,
  msu: 0,
  fieldcomm: 0,
  mcp: 0,
  hazmat: 0,
  htmu: 0,
  hazmatsupport: 0,
  hazmatbattalion: 0,
  rescuebattalion: 0,
  safetybattalion: 0,
  brush: 0,
  collapse: 0,
  purplek: 0,
  imt: 0,
  highrise: 0,
  thawing: 0,
  patrolCar: 0,
} satisfies AssignmentRequirements) as (keyof AssignmentRequirements)[];

/** Display labels for each assignment-requirement category. */
export const CATEGORY_LABELS: Record<keyof AssignmentRequirements, string> = {
  engine: "Engines",
  ladder: "Ladders",
  rescue: "Rescues",
  squad: "Squads",
  squad2piece: "Squads (2-Piece)",
  battalion: "Battalions",
  division: "Divisions",
  rac: "RAC",
  satellite: "Satellite",
  tsu: "TSU",
  msu: "MSU",
  fieldcomm: "Field Comm.",
  mcp: "MCP",
  hazmat: "HazMat",
  htmu: "HTMU",
  hazmatsupport: "HazMat Support",
  hazmatbattalion: "Battalion HazMat",
  rescuebattalion: "Battalion Rescue",
  safetybattalion: "Battalion Safety",
  brush: "Brush",
  collapse: "Collapse",
  purplek: "Purple-K",
  imt: "IMT",
  highrise: "High Rise",
  thawing: "Thawing",
  patrolCar: "Patrol Cars",
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

/**
 * Computes the effective unit need for one category given the base assignment,
 * additive extras ("additional" modifiers), and a required minimum floor
 * ("required" modifiers).
 */
export function effectiveNeed(
  assignment: Assignment,
  key: keyof AssignmentRequirements,
  extra?: Partial<AssignmentRequirements>,
  required?: Partial<AssignmentRequirements>
): number {
  return Math.max(
    assignment[key] + (extra?.[key] ?? 0),
    required?.[key] ?? 0
  );
}

/**
 * True if every unit category's effective need (assignment + extras, floored by
 * required minimums from modifiers) is met by the on-scene units.
 */
export function isAssignmentStaffed(
  assignment: Assignment,
  onSceneUnits: DispatchRecord[],
  extra?: Partial<AssignmentRequirements>,
  required?: Partial<AssignmentRequirements>
): boolean {
  const counts = countOnSceneByCategory(onSceneUnits);
  return REQUIREMENT_KEYS.every(
    (key) => (counts[key] ?? 0) >= effectiveNeed(assignment, key, extra, required)
  );
}
