import type { NypdStation } from "../models";

const POLICE_NAVY = "#1e3a8a";

const POLICE_SVG = `
<svg width="30" height="30" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round">
    <path d="M16 3 L25 6.5 V14.5 C25 20.2 21.4 25.1 16 28 C10.6 25.1 7 20.2 7 14.5 V6.5 Z" fill="${POLICE_NAVY}"/>
    <path d="M16 8.5 L17.8 12.2 L21.9 12.8 L18.9 15.7 L19.6 19.8 L16 17.9 L12.4 19.8 L13.1 15.7 L10.1 12.8 L14.2 12.2 Z" fill="#ffffff" stroke="#ffffff" stroke-width="0.7"/>
  </g>
</svg>`;

export function createNypdStationElement(station: NypdStation): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "30px";
  el.style.height = "30px";
  el.style.cursor = "pointer";
  el.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.55))";
  el.style.transform = "scale(var(--marker-scale, 1))";
  el.style.transformOrigin = "center";
  el.innerHTML = POLICE_SVG;
  el.title = station.name;
  return el;
}