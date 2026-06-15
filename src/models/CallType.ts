export interface CallType {
  id: string;
  name: string;
  /** Relative spawn frequency (higher = more common). */
  weight: number;
  /** Response perimeter radius in meters around the call. */
  radius: number;
  /** Id of the mandatory-response assignment this call type starts at. */
  assignmentId: string;
}
