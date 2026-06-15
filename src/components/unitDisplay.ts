import type { UnitStatus } from "../models";

/** Color used to indicate a unit's status (dot/label) across the UI. */
export function statusColor(status: UnitStatus): string {
  switch (status) {
    case "Available":
      return "#16a34a"; // green
    case "En Route":
      return "#f59e0b"; // amber
    case "On Scene":
      return "#dc2626"; // red
    case "Relocating":
      return "#8b5cf6"; // violet
    default:
      return "#64748b"; // slate
  }
}
