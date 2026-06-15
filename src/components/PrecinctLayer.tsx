import { useEffect, useRef } from "react";
import { Popup, type Map as MapLibreMap, type MapLayerMouseEvent } from "maplibre-gl";
import { nypdPrecincts } from "../data/nypdPrecincts";
import { useNypdStationStore } from "../stores/nypdStationStore";
import { useSettingsStore } from "../stores/settingsStore";
import { buildNypdStationPopupContent } from "./nypdStationPopup";

interface PrecinctLayerProps {
  map: MapLibreMap;
}

const SOURCE = "nypd-precincts";
const FILL_LAYER = "nypd-precincts-fill";
const LINE_LAYER = "nypd-precincts-outline";

const PRECINCT_COLOR = "#1e3a8a"; // navy, matches the NYPD marker

/** How often (real ms) to refresh the live status breakdown while a popup is open. */
const POPUP_REFRESH_MS = 2000;

/** Draws real NYPD precinct boundary polygons and opens a status popup on click. */
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
        paint: {
          "fill-color": PRECINCT_COLOR,
          "fill-opacity": 0.05,
        },
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
    if (map.getLayer(FILL_LAYER)) {
      map.setLayoutProperty(FILL_LAYER, "visibility", visibility);
    }
    if (map.getLayer(LINE_LAYER)) {
      map.setLayoutProperty(LINE_LAYER, "visibility", visibility);
    }
  }, [map, showPrecinctBoundaries]);

  // Hover cursor + click-to-open status popup.
  useEffect(() => {
    const onMouseEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onMouseLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    const onClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const stationId = feature?.properties?.stationId as string | undefined;
      if (!stationId) {
        return;
      }
      const station = useNypdStationStore
        .getState()
        .stations.find((s) => s.id === stationId);
      if (!station) {
        return;
      }

      popupRef.current?.remove();
      const popup = new Popup({ offset: 12, closeButton: true })
        .setLngLat(e.lngLat)
        .setDOMContent(buildNypdStationPopupContent(station))
        .addTo(map);
      popupRef.current = popup;

      const refreshId = window.setInterval(() => {
        popup.setDOMContent(buildNypdStationPopupContent(station));
      }, POPUP_REFRESH_MS);
      popup.on("close", () => window.clearInterval(refreshId));
    };

    map.on("mouseenter", FILL_LAYER, onMouseEnter);
    map.on("mouseleave", FILL_LAYER, onMouseLeave);
    map.on("click", FILL_LAYER, onClick);

    return () => {
      map.off("mouseenter", FILL_LAYER, onMouseEnter);
      map.off("mouseleave", FILL_LAYER, onMouseLeave);
      map.off("click", FILL_LAYER, onClick);
      popupRef.current?.remove();
    };
  }, [map]);

  return null;
}
