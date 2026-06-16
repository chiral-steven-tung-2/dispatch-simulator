/** Minimum unit counts, by category, required to be on scene for an assignment. */
export interface AssignmentRequirements {
  engine: number;
  ladder: number;
  rescue: number;
  squad: number;
  squad2piece: number;
  battalion: number;
  division: number;
  rac: number;
  satellite: number;
  tsu: number;
  msu: number;
  fieldcomm: number;
  mcp: number;
  hazmat: number;
  htmu: number;
  hazmatsupport: number;
  hazmatbattalion: number;
  rescuebattalion: number;
  safetybattalion: number;
  brush: number;
  collapse: number;
  purplek: number;
  imt: number;
  highrise: number;
  thawing: number;
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
  /** Minimum on-scene work time (game-seconds) before the call can auto-resolve. */
  minResolveS: number;
  /** Maximum on-scene work time (game-seconds) before the call auto-resolves. */
  maxResolveS: number;
}
