import { useEffect } from "react";
import type {
  Map as MapLibreMap,
  GeoJSONSource,
  DataDrivenPropertyValueSpecification,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Polygon } from "geojson";
import { useIncidentStore } from "../stores/incidentStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { circlePolygon } from "../utils/geo";

interface CallAreaLayerProps {
  map: MapLibreMap;
}

const SOURCE = "call-areas";
const FILL_LAYER = "call-areas-fill";
const LINE_DASHED = "call-areas-outline-dashed";
const LINE_SOLID = "call-areas-outline-solid";
const DEFAULT_RADIUS = 80;

const EMPTY: FeatureCollection<Polygon> = {
  type: "FeatureCollection",
  features: [],
};

// Perimeter color by call status (shared by fill + both outline layers).
const colorByStatus: DataDrivenPropertyValueSpecification<string> = [
  "match",
  ["get", "status"],
  "Waiting", "#dc2626",
  "Active", "#f59e0b",
  "Resolved", "#64748b",
  "#dc2626",
];

/**
 * Draws the response-perimeter circle around each call. The outline is dashed
 * while a call is unstaffed and switches to a bold solid ring (with a stronger
 * fill) once a unit is on scene.
 */
export default function CallAreaLayer({ map }: CallAreaLayerProps) {
  const incidents = useIncidentStore((s) => s.incidents);
  const dispatches = useDispatchStore((s) => s.dispatches);

  // Add source + layers once.
  useEffect(() => {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: EMPTY });
    }
    if (!map.getLayer(FILL_LAYER)) {
      map.addLayer({
        id: FILL_LAYER,
        type: "fill",
        source: SOURCE,
        paint: {
          "fill-color": colorByStatus,
          // Stronger fill once units are on scene.
          "fill-opacity": ["case", ["get", "staffed"], 0.2, 0.1],
        },
      });
    }
    // Dashed outline for unstaffed calls (no unit on scene yet).
    if (!map.getLayer(LINE_DASHED)) {
      map.addLayer({
        id: LINE_DASHED,
        type: "line",
        source: SOURCE,
        filter: ["!", ["get", "staffed"]],
        layout: { "line-join": "round" },
        paint: {
          "line-color": colorByStatus,
          "line-width": 1.5,
          "line-opacity": 0.6,
          "line-dasharray": [2, 1.5],
        },
      });
    }
    // Bold solid outline once a unit is on scene.
    if (!map.getLayer(LINE_SOLID)) {
      map.addLayer({
        id: LINE_SOLID,
        type: "line",
        source: SOURCE,
        filter: ["get", "staffed"],
        layout: { "line-join": "round" },
        paint: {
          "line-color": colorByStatus,
          "line-width": 3,
          "line-opacity": 0.95,
        },
      });
    }

    return () => {
      if (map.getLayer(LINE_SOLID)) map.removeLayer(LINE_SOLID);
      if (map.getLayer(LINE_DASHED)) map.removeLayer(LINE_DASHED);
      if (map.getLayer(FILL_LAYER)) map.removeLayer(FILL_LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  }, [map]);

  // Rebuild perimeters when calls or their on-scene status change.
  useEffect(() => {
    const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }
    const staffedCalls = new Set(
      dispatches.filter((d) => d.phase === "onScene").map((d) => d.callId)
    );
    const features: Feature<Polygon>[] = incidents.map((incident) => ({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          circlePolygon(
            [incident.longitude, incident.latitude],
            incident.radiusMeters || DEFAULT_RADIUS
          ),
        ],
      },
      properties: {
        status: incident.status,
        staffed: staffedCalls.has(incident.id),
      },
    }));
    source.setData({ type: "FeatureCollection", features });
  }, [map, incidents, dispatches]);

  return null;
}
