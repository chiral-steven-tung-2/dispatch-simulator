export type UnitStatus = "Available" | "En Route" | "On Scene";

export interface Unit {
  id: string;
  callsign: string;
  /** Open-ended apparatus type, e.g. "Engine", "Aerial Ladder", "HazMat", "Battalion". */
  type: string;
  status: UnitStatus;
  /** Id of the station this unit is quartered at. */
  stationId: string;
}
