import { useEffect } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import { nycLand } from "../data/nycLand";

interface LandLayerProps {
  map: MapLibreMap;
}

const SOURCE = "nyc-land";
const FILL_LAYER = "nyc-land-fill";
const LINE_LAYER = "nyc-land-outline";

/** Draws the NYC borough land polygons (faint fill + outline) on the map. */
export default function LandLayer({ map }: LandLayerProps) {
  useEffect(() => {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: nycLand });
    }
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE,
        paint: { "fill-color": "#38bdf8", "fill-opacity": 0.06 },
      });
    }
    if (!map.getLayer(LINE_LAYER)) {
      map.addLayer({
        id: LINE_LAYER,
        type: "line",
        source: SOURCE,
        layout: { "line-join": "round" },
        paint: { "line-color": "#38bdf8", "line-width": 1.5, "line-opacity": 0.6 },
      });
    }

    return () => {
      if (map.getLayer(LINE_LAYER)) map.removeLayer(LINE_LAYER);
      if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  }, [map]);

  return null;
}
