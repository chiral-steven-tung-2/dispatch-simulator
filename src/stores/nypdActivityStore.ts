import { create } from "zustand";
import { GAME_CONFIG } from "../config/gameConfig";

const { minFraction, maxFraction } = GAME_CONFIG.nypdPatrol.onAssignment;

interface NypdActivityStore {
  /** Simulated "On Assignment" share (0-1) of each precinct's fleet, keyed by station id. */
  onAssignmentFractionByStation: Record<string, number>;
  /** Re-rolls the on-assignment fraction for the given station within the configured bounds. */
  roll: (stationId: string) => void;
}

function randomFraction(): number {
  return minFraction + Math.random() * (maxFraction - minFraction);
}

export const useNypdActivityStore = create<NypdActivityStore>((set) => ({
  onAssignmentFractionByStation: {},
  roll: (stationId) =>
    set((s) => ({
      onAssignmentFractionByStation: {
        ...s.onAssignmentFractionByStation,
        [stationId]: randomFraction(),
      },
    })),
}));

const DEFAULT_FRACTION = (minFraction + maxFraction) / 2;

/** Fraction (0-1) of `stationId`'s fleet simulated as "On Assignment". */
export function getOnAssignmentFraction(stationId: string): number {
  return (
    useNypdActivityStore.getState().onAssignmentFractionByStation[stationId] ??
    DEFAULT_FRACTION
  );
}
