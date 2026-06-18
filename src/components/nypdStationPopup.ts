import type { NypdStation } from "../models";
import { useUnitStore } from "../stores/unitStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { usePatrolStore } from "../stores/patrolStore";

export function buildNypdStationPopupContent(station: NypdStation): HTMLElement {
  const allUnits = useUnitStore.getState().units;
  const dispatches = useDispatchStore.getState().dispatches;
  const patrolRecords = usePatrolStore.getState().records;

  const stationUnits = allUnits.filter(
    (u) => u.type === "Patrol Car" && u.currentStationId === station.id
  );

  const patrolUnitIds = new Set(patrolRecords.map((r) => r.unitId));

  const onPatrol = stationUnits.filter(
    (u) => u.status === "Available" && patrolUnitIds.has(u.id)
  ).length;

  const atStation = stationUnits.filter(
    (u) =>
      u.status === "Available" &&
      !patrolUnitIds.has(u.id) &&
      !dispatches.some((d) => d.unitId === u.id)
  ).length;

  const atCall = stationUnits.filter((u) =>
    dispatches.some(
      (d) =>
        d.unitId === u.id &&
        (d.phase === "dispatched" || d.phase === "enroute" || d.phase === "onScene")
    )
  ).length;

  const returning = stationUnits.filter((u) =>
    dispatches.some((d) => d.unitId === u.id && d.phase === "returning")
  ).length;

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
  label.textContent = "Patrol Cars";
  root.appendChild(label);

  const assigned = document.createElement("div");
  assigned.className = "mt-1 text-xs text-slate-500";
  assigned.textContent = `${station.assignedPatrolCars} assigned to precinct`;
  root.appendChild(assigned);

  const statusList = document.createElement("dl");
  statusList.className = "mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs";

  for (const [statLabel, value] of [
    ["On Patrol", onPatrol],
    ["At Station", atStation],
    ["At Call", atCall],
    ["Returning", returning],
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
