/** Minimum unit counts, by category, required to be on scene for an assignment. */
export interface AssignmentRequirements {
  engines: number;
  trucks: number;
  rescues: number;
  squads: number;
  battalions: number;
  divisions: number;
  rac: number;
  satellite: number;
  tsu: number;
  hazmat: number;
}

/**
 * A mandatory-response staffing level (e.g. "Standard", "All Hands"). Calls are
 * dispatched at an initial assignment and may escalate to `upgradeTo` once fully
 * staffed and worked for a while, rolling `upgradeProbability` each check.
 */
export interface Assignment extends AssignmentRequirements {
  id: string;
  name: string;
  upgradeProbability: number;
  upgradeTo: string | null;
}
