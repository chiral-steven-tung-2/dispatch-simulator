import type { NypdStation } from "../models";
import { useSettingsStore } from "../stores/settingsStore";
import { getOnAssignmentFraction } from "../stores/nypdActivityStore";
import { getPrecinctUnitStatus } from "../utils/nypdPatrol";

/** Builds (or rebuilds) the popup content for an NYPD precinct, including a live patrol status breakdown. */
export function buildNypdStationPopupContent(station: NypdStation): HTMLElement {
  const root = document.createElement("div");
  root.className = "min-w-[220px] text-slate-900";

  const title = document.createElement("div");
  title.className = "font-bold text-sm";
  title.textContent = station.name;
  root.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "text-xs text-slate-500 mt-1";
  meta.textContent = station.address;
  root.appendChild(meta);

  const label = document.createElement("div");
  label.className = "mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400";
  label.textContent = "NYPD precinct";
  root.appendChild(label);

  const patrolPercent = useSettingsStore.getState().patrolPercent;
  const onAssignmentFraction = getOnAssignmentFraction(station.id);
  const status = getPrecinctUnitStatus(
    station.assignedPatrolCars,
    onAssignmentFraction,
    patrolPercent
  );

  const statusList = document.createElement("dl");
  statusList.className = "mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs";
  for (const [statLabel, value] of [
    ["Assigned patrol cars", status.assigned],
    ["On patrol", status.onPatrol],
    ["On assignment", status.onAssignment],
    ["At precinct", status.atPrecinct],
  ] as const) {
    const dt = document.createElement("dt");
    dt.className = "text-slate-500";
    dt.textContent = statLabel;
    const dd = document.createElement("dd");
    dd.className = "text-right font-semibold";
    dd.textContent = String(value);
    statusList.appendChild(dt);
    statusList.appendChild(dd);
  }
  root.appendChild(statusList);

  return root;
}