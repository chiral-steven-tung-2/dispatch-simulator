export type UnitStatus = "Available" | "En Route" | "On Scene" | "Relocating";

export interface Unit {
  id: string;
  callsign: string;
  /** Open-ended apparatus type, e.g. "Engine", "Aerial Ladder", "HazMat", "Battalion". */
  type: string;
  status: UnitStatus;
  /** Id of the station this unit is permanently quartered at (home). */
  stationId: string;
  /** Id of the station this unit is currently garaged at (differs from stationId while relocated). */
  currentStationId: string;
  /** Number of firefighters staffing this unit. */
  ffCount: number;
}
