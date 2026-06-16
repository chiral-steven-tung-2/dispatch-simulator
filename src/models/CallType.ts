export interface CallType {
  id: string;
  name: string;
  /** Spawn category key (matches CallSpawnCategory.category). */
  category: string;
  /** Response perimeter radius in meters around the call. */
  radius: number;
  /** Id of the mandatory-response assignment this call type starts at. */
  assignmentId: string;
  /** Borough restriction, or "City-wide" if unrestricted. */
  spawnBorough: string;
}

export interface CallSpawnCategory {
  id: string;
  category: string;
  /** Fractional probability (0–1) that this category is chosen on a spawn roll. */
  probability: number;
}
