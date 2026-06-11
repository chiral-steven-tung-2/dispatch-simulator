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
