import { useEffect, useRef } from "react";
import { Popup, type Map as MapLibreMap, type MapLayerMouseEvent } from "maplibre-gl";
import { nypdPrecincts } from "../data/nypdPrecincts";
import { useSettingsStore } from "../stores/settingsStore";

interface PrecinctLayerProps {
  map: MapLibreMap;
}

const SOURCE = "nypd-precincts";
const FILL_LAYER = "nypd-precincts-fill";
const LINE_LAYER = "nypd-precincts-outline";

const PRECINCT_COLOR = "#1e3a8a";

export default function PrecinctLayer({ map }: PrecinctLayerProps) {
  const showPrecinctBoundaries = useSettingsStore((s) => s.showPrecinctBoundaries);
  const popupRef = useRef<Popup | null>(null);

  // Add the source + layers once.
  useEffect(() => {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: nypdPrecincts });
    }
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE,
        paint: { "fill-color": PRECINCT_COLOR, "fill-opacity": 0.05 },
      });
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE,
        layout: { "line-join": "round" },
        paint: { "line-color": PRECINCT_COLOR, "line-width": 1.5, "line-opacity": 0.7 },
      });
    }

    return () => {
      if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
      if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  }, [map]);

  // Toggle visibility.
  useEffect(() => {
    const visibility = showPrecinctBoundaries ? "visible" : "none";
    if (map.getLayer(FILL_LAYER)) map.setLayoutProperty(FILL_LAYER, "visibility", visibility);
    if (map.getLayer(LINE_LAYER)) map.setLayoutProperty(LINE_LAYER, "visibility", visibility);
  }, [map, showPrecinctBoundaries]);

  // Hover-only tooltip showing the precinct name after 2 s of stillness.
  useEffect(() => {
    let hoverTimer: number | undefined;

    const getPopup = () => {
      if (!popupRef.current) {
        popupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 8 });
      }
      return popupRef.current;
    };

    const onMouseMove = (e: MapLayerMouseEvent) => {
      const name = e.features?.[0]?.properties?.precinct as string | undefined;
      if (!name) return;

      // Reset the timer on every move — only show after the cursor settles.
      window.clearTimeout(hoverTimer);
      popupRef.current?.remove();

      const lngLat = e.lngLat;
      hoverTimer = window.setTimeout(() => {
        const el = document.createElement("div");
        el.style.cssText =
          "display:flex;align-items:center;gap:6px;padding:5px 9px;background:#1e3a8a;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.35);";
        const badge = document.createElement("span");
        badge.textContent = "NYPD";
        badge.style.cssText =
          "font-size:9px;font-weight:700;letter-spacing:0.05em;color:#93c5fd;background:rgba(255,255,255,0.12);border-radius:3px;padding:1px 4px;";
        const label = document.createElement("span");
        label.textContent = name;
        label.style.cssText = "font-size:12px;font-weight:600;color:#ffffff;white-space:nowrap;";
        el.appendChild(badge);
        el.appendChild(label);
        getPopup().setLngLat(lngLat).setDOMContent(el).addTo(map);
      }, 1000);
    };

    const onMouseLeave = () => {
      window.clearTimeout(hoverTimer);
      popupRef.current?.remove();
    };

    map.on("mousemove", FILL_LAYER, onMouseMove);
    map.on("mouseleave", FILL_LAYER, onMouseLeave);

    return () => {
      window.clearTimeout(hoverTimer);
      map.off("mousemove", FILL_LAYER, onMouseMove);
      map.off("mouseleave", FILL_LAYER, onMouseLeave);
      popupRef.current?.remove();
    };
  }, [map]);

  return null;
}
