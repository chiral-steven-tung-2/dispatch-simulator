import type { Station, Unit } from "../models";
import { statusColor } from "./unitDisplay";

/**
 * Builds the DOM content shown when a station marker is clicked: station details
 * plus the list of units quartered there. Using DOM nodes (not innerHTML) keeps
 * data-driven text safe from injection.
 */
export function buildStationPopupContent(
  station: Station,
  units: Unit[]
): HTMLElement {
  const root = document.createElement("div");
  root.className = "min-w-[200px] text-slate-900";

  const title = document.createElement("div");
  title.className = "font-bold text-sm";
  title.textContent = station.name;
  root.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "text-xs text-slate-500 mb-2";
  meta.textContent = `${station.borough} · ${station.battalion} · ${station.division}`;
  root.appendChild(meta);

  const heading = document.createElement("div");
  heading.className = "text-xs font-semibold uppercase tracking-wide text-slate-400";
  heading.textContent = `Units quartered (${units.length})`;
  root.appendChild(heading);

  if (units.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-slate-500 italic mt-1";
    empty.textContent = "No units assigned";
    root.appendChild(empty);
    return root;
  }

  const list = document.createElement("ul");
  list.className = "mt-1 space-y-1";

  for (const unit of units) {
    const item = document.createElement("li");
    item.className = "flex items-center gap-2 text-xs";

    const dot = document.createElement("span");
    dot.className = "inline-block h-2 w-2 rounded-full shrink-0";
    dot.style.backgroundColor = statusColor(unit.status);
    dot.title = unit.status;
    item.appendChild(dot);

    const label = document.createElement("span");
    label.className = "font-medium";
    label.textContent = unit.callsign;
    item.appendChild(label);

    const type = document.createElement("span");
    type.className = "text-slate-500";
    type.textContent = `· ${unit.type}`;
    item.appendChild(type);

    list.appendChild(item);
  }

  root.appendChild(list);
  return root;
}
