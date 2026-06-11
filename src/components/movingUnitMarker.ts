import type { DispatchPhase } from "../stores/dispatchStore";

export const EN_ROUTE_COLOR = "#f59e0b"; // amber
export const ON_SCENE_COLOR = "#dc2626"; // red
export const RETURNING_COLOR = "#0ea5e9"; // sky

export function colorForPhase(phase: DispatchPhase): string {
  switch (phase) {
    case "enroute":
      return EN_ROUTE_COLOR;
    case "onScene":
      return ON_SCENE_COLOR;
    case "returning":
      return RETURNING_COLOR;
    default:
      return EN_ROUTE_COLOR;
  }
}

/** Builds a small labeled pill used to represent a unit moving on the map. */
export function createMovingUnitElement(label: string): HTMLDivElement {
  const el = document.createElement("div");
  el.textContent = label;
  el.style.padding = "2px 6px";
  el.style.fontSize = "10px";
  el.style.fontWeight = "700";
  el.style.lineHeight = "1";
  el.style.color = "white";
  el.style.whiteSpace = "nowrap";
  el.style.borderRadius = "9999px";
  el.style.border = "1px solid white";
  el.style.backgroundColor = EN_ROUTE_COLOR;
  el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.5)";
  el.style.pointerEvents = "none";
  return el;
}
