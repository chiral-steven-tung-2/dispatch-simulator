/** A precinct's patrol car fleet, broken down by current status. */
export interface PrecinctUnitStatus {
  /** Total patrol cars assigned to the precinct. */
  assigned: number;
  /** Simulated cars currently out on a call. */
  onAssignment: number;
  /** Cars driving around the precinct, per the global patrol-coverage slider. */
  onPatrol: number;
  /** Cars parked at the precinct house. */
  atPrecinct: number;
}

/**
 * Splits a precinct's assigned patrol cars into On Assignment / On Patrol / At
 * Precinct. `onAssignment` is taken first (simulated baseline), and the global
 * `patrolPercent` slider splits the remainder between On Patrol and At Precinct.
 */
export function getPrecinctUnitStatus(
  assignedPatrolCars: number,
  onAssignmentFraction: number,
  patrolPercent: number
): PrecinctUnitStatus {
  const onAssignment = Math.round(assignedPatrolCars * onAssignmentFraction);
  const remaining = assignedPatrolCars - onAssignment;
  const onPatrol = Math.round(remaining * (patrolPercent / 100));
  const atPrecinct = remaining - onPatrol;

  return { assigned: assignedPatrolCars, onAssignment, onPatrol, atPrecinct };
}
