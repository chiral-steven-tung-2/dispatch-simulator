export interface CallType {
  id: string;
  name: string;
  /** Relative spawn frequency (higher = more common). */
  weight: number;
  /** Response perimeter radius in meters around the call. */
  radius: number;
}
