export type IncidentStatus = "Waiting" | "Active" | "Resolved";

export interface Incident {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: IncidentStatus;
  /** Current response-perimeter radius (m); grows as units arrive on scene. */
  radiusMeters: number;
  /** Maximum perimeter radius (m) — from the call type. Growth caps here. */
  maxRadiusMeters: number;
  /**
   * performance.now() timestamp when on-scene work began. Drives the resolve
   * countdown; undefined until a unit is working the call.
   */
  resolveStartedAt?: number;
}
