export type PoliceUnitStatus =
  | { kind: "patrol" }
  | { kind: "dispatched"; phase: string; callName: string }
  | { kind: "returning"; precinctName: string };

export function buildPoliceUnitPopupContent(
  callsign: string,
  precinctName: string,
  status: PoliceUnitStatus
): HTMLElement {
  const root = document.createElement("div");
  root.className = "min-w-[190px] text-slate-900";

  const title = document.createElement("div");
  title.className = "font-bold text-sm";
  title.textContent = callsign;
  root.appendChild(title);

  const subtitle = document.createElement("div");
  subtitle.className = "text-xs text-slate-500 mt-0.5";
  subtitle.textContent = precinctName;
  root.appendChild(subtitle);

  const divider = document.createElement("div");
  divider.className = "my-2 border-t border-slate-200";
  root.appendChild(divider);

  const dl = document.createElement("dl");
  dl.className = "grid grid-cols-2 gap-x-3 gap-y-1 text-xs";

  const addRow = (label: string, value: string, valueClass = "font-semibold") => {
    const dt = document.createElement("dt");
    dt.className = "text-slate-500";
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.className = `text-right ${valueClass}`;
    dd.textContent = value;
    dl.appendChild(dt);
    dl.appendChild(dd);
  };

  if (status.kind === "patrol") {
    addRow("Status", "On Patrol", "font-semibold text-blue-600");
  } else if (status.kind === "dispatched") {
    const phaseLabel: Record<string, string> = {
      dispatched: "Turning out",
      enroute: "En Route",
      onScene: "On Scene",
    };
    addRow("Status", phaseLabel[status.phase] ?? status.phase, "font-semibold text-amber-600");
    addRow("Call", status.callName);
  } else {
    addRow("Status", "Returning", "font-semibold text-sky-600");
    addRow("To", status.precinctName);
  }

  root.appendChild(dl);
  return root;
}
