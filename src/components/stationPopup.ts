import type { Station, Unit } from "../models";
import { statusColor } from "./unitDisplay";
import { relocationTargets, replacingUnitName } from "../utils/garage";
import { formatDistance } from "../utils/geo";
import { useRelocationStore, type RelocationRecord } from "../stores/relocationStore";

/** Short status note shown beneath a unit row in the popup. */
function describeLocation(
  unit: Unit,
  station: Station,
  relocation: RelocationRecord | undefined,
  allUnits: Unit[],
  stationName: (id: string) => string
): string {
  if (unit.status === "Relocating" && relocation) {
    if (relocation.toStationId === unit.stationId) {
      return "Returning home";
    }
    const replacing = replacingUnitName(
      relocation.toStationId,
      relocation.type,
      relocation.unitId,
      allUnits
    );
    return replacing
      ? `${unit.callsign} Act. ${replacing}`
      : `Relocating → ${stationName(relocation.toStationId)}`;
  }
  // A guest unit currently garaged here (its permanent home is elsewhere).
  if (unit.stationId !== station.id && unit.currentStationId === station.id) {
    return unit.status === "Available"
      ? `Covering from ${stationName(unit.stationId)}`
      : `${unit.status} · from ${stationName(unit.stationId)}`;
  }
  // A home unit currently parked somewhere else.
  if (unit.currentStationId !== station.id) {
    const hostName = stationName(unit.currentStationId);
    return unit.status === "Available"
      ? `At ${hostName}`
      : `${unit.status} · at ${hostName}`;
  }
  return unit.status;
}

/** Fills (or clears) a picker container with relocation destination options. */
function renderRelocationPicker(
  container: HTMLElement,
  unit: Unit,
  station: Station,
  allStations: Station[],
  allUnits: Unit[],
  onPick: () => void
): void {
  container.innerHTML = "";

  const targets = relocationTargets(
    unit.type,
    station.id,
    allStations,
    allUnits,
    [station.longitude, station.latitude]
  ).slice(0, 6);

  if (targets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-[11px] italic text-slate-500";
    empty.textContent = `No stations with an open ${unit.type} bay nearby.`;
    container.appendChild(empty);
    return;
  }

  const list = document.createElement("ul");
  list.className = "space-y-0.5";

  for (const { station: target, distanceMeters, openSlots } of targets) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.className =
      "flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] hover:bg-slate-100";

    const name = document.createElement("span");
    name.textContent = `${target.name} (${openSlots} open bay${openSlots === 1 ? "" : "s"})`;

    const dist = document.createElement("span");
    dist.className = "shrink-0 text-slate-500";
    dist.textContent = formatDistance(distanceMeters);

    button.append(name, dist);
    button.addEventListener("click", () => {
      void useRelocationStore.getState().relocateUnit(unit, target.id);
      onPick();
    });

    item.appendChild(button);
    list.appendChild(item);
  }

  container.appendChild(list);
}

/**
 * Builds the DOM content shown when a station marker is clicked: station details
 * plus the list of units quartered there, with relocation/recall controls. Using
 * DOM nodes (not innerHTML) keeps data-driven text safe from injection.
 */
export function buildStationPopupContent(
  station: Station,
  units: Unit[],
  allUnits: Unit[],
  allStations: Station[],
  relocations: RelocationRecord[]
): HTMLElement {
  const stationName = (id: string) =>
    allStations.find((s) => s.id === id)?.name ?? id;

  const root = document.createElement("div");
  root.className = "w-64 text-slate-900";

  const title = document.createElement("div");
  title.className = "font-bold text-sm";
  title.textContent = station.name;
  root.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "text-xs text-slate-500 mb-2";
  meta.textContent = `${station.borough} · ${station.battalion} · ${station.division}`;
  root.appendChild(meta);

  // Units permanently quartered here.
  const homeUnits = units;
  // Guest units physically garaged here (or mid-drive into the garage) while
  // their home station is covered. Units returning to their own home are
  // covered by the "Units quartered" list above instead.
  const visitingUnits = allUnits.filter(
    (u) =>
      u.stationId !== station.id &&
      (u.currentStationId === station.id ||
        relocations.some((r) => r.unitId === u.id && r.toStationId === station.id))
  );

  const heading = document.createElement("div");
  heading.className = "text-xs font-semibold uppercase tracking-wide text-slate-400";
  heading.textContent = `Units quartered (${homeUnits.length})`;
  root.appendChild(heading);

  if (homeUnits.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-slate-500 italic mt-1";
    empty.textContent = "No units assigned";
    root.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.className = "mt-1 space-y-1.5";
    for (const unit of homeUnits) {
      list.appendChild(buildUnitItem(unit, station, allStations, allUnits, relocations, stationName));
    }
    root.appendChild(list);
  }

  if (visitingUnits.length > 0) {
    const subHeading = document.createElement("div");
    subHeading.className =
      "mt-2 text-xs font-semibold uppercase tracking-wide text-slate-400";
    subHeading.textContent = `Covering here (${visitingUnits.length})`;
    root.appendChild(subHeading);

    const list = document.createElement("ul");
    list.className = "mt-1 space-y-1.5";
    for (const unit of visitingUnits) {
      list.appendChild(buildUnitItem(unit, station, allStations, allUnits, relocations, stationName));
    }
    root.appendChild(list);
  }

  return root;
}

/** Builds one `<li>` unit row: name line on top, status + controls below. */
function buildUnitItem(
  unit: Unit,
  station: Station,
  allStations: Station[],
  allUnits: Unit[],
  relocations: RelocationRecord[],
  stationName: (id: string) => string
): HTMLElement {
  const item = document.createElement("li");
  item.className = "text-xs";

  const row = document.createElement("div");
  row.className = "flex items-center gap-1.5";

  const dot = document.createElement("span");
  dot.className = "inline-block h-2 w-2 rounded-full shrink-0";
  dot.style.backgroundColor = statusColor(unit.status);
  dot.title = unit.status;
  row.appendChild(dot);

  const label = document.createElement("span");
  label.className = "font-medium truncate";
  label.textContent = unit.callsign;
  row.appendChild(label);

  const type = document.createElement("span");
  type.className = "text-slate-500 shrink-0";
  type.textContent = `· ${unit.type}`;
  row.appendChild(type);

  const relocation = relocations.find((r) => r.unitId === unit.id);

  // Whether the unit is physically parked at this station right now.
  const here = unit.currentStationId === station.id;
  const isGuest = unit.stationId !== station.id;

  // Right-aligned control button (created below for the cases that need one).
  let button: HTMLButtonElement | undefined;
  let picker: HTMLDivElement | undefined;

  if (here && !isGuest && unit.status === "Available") {
    // Home unit, available, parked at home → can relocate it out.
    picker = document.createElement("div");
    picker.className = "mt-1 hidden rounded border border-slate-200 bg-slate-50 p-1.5";

    button = document.createElement("button");
    button.textContent = "Relocate";
    button.addEventListener("click", () => {
      const isHidden = picker!.classList.contains("hidden");
      if (isHidden) {
        renderRelocationPicker(picker!, unit, station, allStations, allUnits, () => {
          picker!.classList.add("hidden");
          button!.textContent = "Relocate";
        });
        picker!.classList.remove("hidden");
        button!.textContent = "Cancel";
      } else {
        picker!.classList.add("hidden");
        button!.textContent = "Relocate";
      }
    });
  } else if (isGuest && here && unit.status === "Available" && !relocation) {
    // Guest unit covering here → send it back to its own house.
    button = document.createElement("button");
    button.textContent = "Send home";
    button.addEventListener("click", () => {
      void useRelocationStore.getState().sendUnitHome(unit);
    });
  } else if (!here && !isGuest && unit.status === "Available" && !relocation) {
    // Home unit relocated elsewhere → recall it.
    button = document.createElement("button");
    button.textContent = "Recall";
    button.addEventListener("click", () => {
      void useRelocationStore.getState().sendUnitHome(unit);
    });
  } else if (unit.status === "Relocating" && relocation) {
    // Unit mid-drive (relocating out or returning home) → cancel the trip.
    button = document.createElement("button");
    button.textContent = "Cancel";
    button.addEventListener("click", () => {
      void useRelocationStore.getState().cancelRelocationFully(unit.id);
    });
  }

  if (button) {
    button.className =
      "ml-auto shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[11px] hover:bg-slate-100";
    row.appendChild(button);
  }

  item.appendChild(row);

  const statusText = describeLocation(unit, station, relocation, allUnits, stationName);
  if (statusText) {
    const status = document.createElement("div");
    status.className = "pl-3.5 text-[11px] text-slate-500";
    status.textContent = statusText;
    item.appendChild(status);
  }

  if (picker) {
    item.appendChild(picker);
  }

  return item;
}
