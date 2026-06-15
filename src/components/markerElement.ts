/**
 * Creates a simple colored circle DOM element to use as a MapLibre marker.
 * Markers are intentionally minimal placeholders for now.
 */
export function createCircleElement(color: string, size = 16): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.backgroundColor = color;
  el.style.border = "2px solid white";
  el.style.borderRadius = "50%";
  el.style.boxShadow = "0 0 4px rgba(0, 0, 0, 0.5)";
  el.style.cursor = "pointer";
  return el;
}

/**
 * Creates a status-colored circle marker for an incident. Fire-related calls
 * show a flame glyph on top of the status color so they stand out on the map.
 */
export function createIncidentElement(
  color: string,
  size = 18,
  isFire = false
): HTMLDivElement {
  const el = createCircleElement(color, size);
  if (isFire) {
    el.style.display = "flex";
    el.style.alignItems = "center";
    el.style.justifyContent = "center";
    el.style.fontSize = `${Math.round(size * 0.75)}px`;
    el.style.lineHeight = "1";
    el.textContent = "🔥";
  }
  return el;
}
