import type { Unit } from "../models";

export type ChiefLevel = "none" | "battalion" | "division";

/** A station is a chief's quarters if it houses a Battalion or Division unit. */
export function chiefLevelFor(units: Unit[]): ChiefLevel {
  if (units.some((u) => u.type === "Division")) {
    return "division";
  }
  if (units.some((u) => u.type === "Battalion")) {
    return "battalion";
  }
  return "none";
}

interface Apparatus {
  tag: string;
  color: string;
}

// Acronym + chip color per apparatus type. Anything not listed here falls back
// to "SOC" (Special Operations Command).
const APPARATUS: Record<string, Apparatus> = {
  Engine: { tag: "E", color: "#dc2626" }, // red
  "Rear Mount": { tag: "HL", color: "#2563eb" }, // blue
  "Tractor Trailor": { tag: "TT", color: "#1d4ed8" }, // darker blue
  "Tower Ladder": { tag: "TL", color: "#1d4ed8" }, // darker blue
  HazMat: { tag: "HM", color: "#16a34a" }, // green
  Squad: { tag: "SQ", color: "#7c3aed" }, // purple
  Rescue: { tag: "R", color: "#ea580c" }, // orange
  Satellite: { tag: "ST", color: "#0891b2" }, // teal
  "IMT Planning Vehicle": { tag: "IMT", color: "#4f46e5" }, // indigo
  Battalion: { tag: "B", color: "#eab308" }, // gold
  Division: { tag: "D", color: "#d97706" }, // dark gold
};

const SOC: Apparatus = { tag: "SOC", color: "#475569" }; // slate

/** Acronym + color for a unit type; defaults to SOC for anything unmapped. */
export function apparatusFor(type: string): Apparatus {
  return APPARATUS[type] ?? SOC;
}

// Fire-house glyph colors: red when at least one unit is in quarters, slate-gray
// when the house is empty.
const ACTIVE_COLORS = { roof: "#991b1b", body: "#dc2626", door: "#fee2e2" };
const EMPTY_COLORS = { roof: "#475569", body: "#64748b", door: "#e2e8f0" };

/** Fire-house glyph: gabled roof, engine-bay door, white cross emblem. */
function houseSvg({
  roof,
  body,
  door,
}: {
  roof: string;
  body: string;
  door: string;
}): string {
  return `
<svg width="30" height="30" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <g stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round">
    <path d="M3 14 L16 4 L29 14 Z" fill="${roof}"/>
    <rect x="6" y="14" width="20" height="14" fill="${body}"/>
  </g>
  <rect x="11" y="18" width="10" height="10" fill="${door}" stroke="#ffffff" stroke-width="1"/>
  <line x1="11" y1="21.3" x2="21" y2="21.3" stroke="${body}" stroke-width="0.9"/>
  <line x1="11" y1="24.6" x2="21" y2="24.6" stroke="${body}" stroke-width="0.9"/>
  <rect x="15.1" y="8" width="1.8" height="5" fill="#ffffff"/>
  <rect x="13.6" y="9.6" width="4.8" height="1.8" fill="#ffffff"/>
</svg>`;
}

const BADGE: Record<
  Exclude<ChiefLevel, "none">,
  { letter: string; color: string; title: string }
> = {
  battalion: { letter: "B", color: "#eab308", title: "Battalion Chief quarters" },
  division: { letter: "D", color: "#d97706", title: "Division Chief quarters" },
};

/**
 * Builds a fire-house marker element: the red house glyph, a gold "B"/"D" chief
 * badge for chief quarters, and a row of apparatus tags (E, HL, HM, …) for every
 * unit housed there.
 */
export function createStationElement(
  units: Unit[],
  showChiefQuarters = true,
  showUnitIcons = true,
  active = true
): HTMLDivElement {
  // NOTE: don't set `position` here — MapLibre applies `position: absolute` to
  // marker elements and positions them via a pixel transform. Overriding it (e.g.
  // with `relative`) makes markers drift out of place when zooming. The element
  // is still a containing block for the absolutely-positioned children below.
  const el = document.createElement("div");
  el.style.width = "30px";
  el.style.height = "30px";
  el.style.cursor = "pointer";
  el.style.filter = "drop-shadow(0 1px 2px rgba(0,0,0,0.55))";
  el.innerHTML = houseSvg(active ? ACTIVE_COLORS : EMPTY_COLORS);

  const chief = chiefLevelFor(units);
  if (chief !== "none" && showChiefQuarters) {
    const { letter, color, title } = BADGE[chief];
    const badge = document.createElement("div");
    badge.textContent = letter;
    badge.title = title;
    badge.style.position = "absolute";
    badge.style.top = "-5px";
    badge.style.right = "-5px";
    badge.style.width = "16px";
    badge.style.height = "16px";
    badge.style.borderRadius = "9999px";
    badge.style.backgroundColor = color;
    badge.style.border = "1.5px solid white";
    badge.style.color = "white";
    badge.style.fontSize = "10px";
    badge.style.fontWeight = "800";
    badge.style.lineHeight = "13px";
    badge.style.textAlign = "center";
    el.appendChild(badge);
  }

  if (units.length > 0 && showUnitIcons) {
    el.appendChild(buildTagRow(units));
  }

  return el;
}

/** Row of apparatus tags hung just below the house (out of flow, so the house
 * stays centered on its coordinate). */
function buildTagRow(units: Unit[]): HTMLDivElement {
  const row = document.createElement("div");
  row.style.position = "absolute";
  row.style.top = "32px";
  row.style.left = "50%";
  row.style.transform = "translateX(-50%)";
  row.style.display = "flex";
  row.style.gap = "2px";
  row.style.whiteSpace = "nowrap";
  row.style.pointerEvents = "none";

  for (const unit of units) {
    const { tag, color } = apparatusFor(unit.type);
    const chip = document.createElement("span");
    chip.textContent = tag;
    chip.title = `${unit.callsign} (${unit.type})`;
    chip.style.fontSize = "9px";
    chip.style.fontWeight = "700";
    chip.style.lineHeight = "12px";
    chip.style.color = "white";
    chip.style.padding = "0 3px";
    chip.style.borderRadius = "3px";
    chip.style.backgroundColor = color;
    chip.style.border = "1px solid rgba(255,255,255,0.85)";
    chip.style.boxShadow = "0 1px 1px rgba(0,0,0,0.4)";
    row.appendChild(chip);
  }

  return row;
}
