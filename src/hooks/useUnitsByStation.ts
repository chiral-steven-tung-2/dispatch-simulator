import { useMemo } from "react";
import type { Unit } from "../models";
import { useUnitStore } from "../stores/unitStore";

/**
 * Groups all units by the station they are quartered at, keyed by station id.
 */
export function useUnitsByStation(): Record<string, Unit[]> {
  const units = useUnitStore((s) => s.units);

  return useMemo(() => {
    const grouped: Record<string, Unit[]> = {};
    for (const unit of units) {
      (grouped[unit.stationId] ??= []).push(unit);
    }
    return grouped;
  }, [units]);
}
