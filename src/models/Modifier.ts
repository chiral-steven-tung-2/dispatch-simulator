import type { AssignmentRequirements } from "./Assignment";

/**
 * A scene modifier that can be special-called once a call reaches a certain
 * alarm level. Its unit fields are added on top of the base alarm assignment
 * and persist across further upgrades.
 */
export interface Modifier extends AssignmentRequirements {
  id: string;
  name: string;
  /** Assignment level at which this modifier's probability is rolled (e.g. "signal_1075"). */
  triggerAssignment: string;
  /** Call categories this modifier applies to; empty array means any category. */
  callCategories: string[];
  /** Probability (0–1) this modifier fires when its trigger assignment is reached. */
  probability: number;
  /**
   * "additional" — unit counts are stacked on top of the alarm assignment.
   * "required"   — unit counts set a minimum floor; units already covered by the
   *                assignment are not sent again.
   */
  modifierType: "additional" | "required";
}
