import type { NypdStation } from "../models";

export function buildNypdStationPopupContent(station: NypdStation): HTMLElement {
  const root = document.createElement("div");
  root.className = "min-w-[200px] text-slate-900";

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

  return root;
}