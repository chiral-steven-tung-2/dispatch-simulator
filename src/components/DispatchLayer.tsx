import { useEffect, useRef } from "react";
import {
  Marker,
  type Map as MapLibreMap,
  type GeoJSONSource,
} from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { useDispatchStore } from "../stores/dispatchStore";
import { pointAlong, remainingPath } from "../utils/geo";
import { createMovingUnitElement, colorForPhase } from "./movingUnitMarker";

interface DispatchLayerProps {
  map: MapLibreMap;
}

const ROUTE_SOURCE = "dispatch-routes";
const ROUTE_LAYER = "dispatch-routes-line";

// How often (ms) to rebuild the path geometry. Markers move every frame; lines
// refresh a few times a second, which is plenty and avoids needless setData churn.
const LINE_UPDATE_INTERVAL = 120;

const EMPTY_FC: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};

export default function DispatchLayer({ map }: DispatchLayerProps) {
  const dispatches = useDispatchStore((s) => s.dispatches);
  const showPaths = useDispatchStore((s) => s.showPaths);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());

  // Add the route source + line layer once.
  useEffect(() => {
    if (!map.getSource(ROUTE_SOURCE)) {
      map.addSource(ROUTE_SOURCE, { type: "geojson", data: EMPTY_FC });
    }
    if (!map.getLayer(ROUTE_LAYER)) {
      map.addLayer({
        id: ROUTE_LAYER,
        type: "line",
        source: ROUTE_SOURCE,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": [
            "match",
            ["get", "phase"],
            "returning",
            "#0ea5e9",
            "#f59e0b",
          ],
          "line-width": 4,
          "line-opacity": 0.85,
        },
      });
    }

    return () => {
      if (map.getLayer(ROUTE_LAYER)) {
        map.removeLayer(ROUTE_LAYER);
      }
      if (map.getSource(ROUTE_SOURCE)) {
        map.removeSource(ROUTE_SOURCE);
      }
    };
  }, [map]);

  // Create markers for new dispatches; remove markers for completed ones.
  useEffect(() => {
    const markers = markersRef.current;
    const liveIds = new Set(dispatches.map((d) => d.id));

    for (const [markerId, marker] of markers) {
      if (!liveIds.has(markerId)) {
        marker.remove();
        markers.delete(markerId);
      }
    }

    for (const d of dispatches) {
      if (!markers.has(d.id)) {
        const element = createMovingUnitElement(d.callsign);
        element.style.backgroundColor = colorForPhase(d.phase);
        const marker = new Marker({ element })
          .setLngLat(d.route[0] ?? [0, 0])
          .addTo(map);
        markers.set(d.id, marker);
      }
    }
  }, [map, dispatches]);

  // Toggle path visibility.
  useEffect(() => {
    if (map.getLayer(ROUTE_LAYER)) {
      map.setLayoutProperty(
        ROUTE_LAYER,
        "visibility",
        showPaths ? "visible" : "none"
      );
    }
  }, [map, showPaths]);

  // Animation loop: move markers every frame, redraw remaining paths, and fire
  // arrival transitions.
  useEffect(() => {
    let raf = 0;
    let lastLineUpdate = 0;
    const store = useDispatchStore;

    const tick = () => {
      const now = performance.now();
      const state = store.getState();
      const current = state.dispatches;
      const simSpeed = state.simSpeed;
      const frac = (d: (typeof current)[number]) =>
        Math.min(1, Math.max(0, ((now - d.startedAt) * simSpeed) / d.durationMs));

      for (const d of current) {
        const marker = markersRef.current.get(d.id);
        if (!marker) {
          continue;
        }

        if (d.phase === "onScene") {
          marker.setLngLat(d.route[d.route.length - 1] ?? [0, 0]);
          marker.getElement().style.backgroundColor = colorForPhase(d.phase);
          continue;
        }

        const fraction = frac(d);
        marker.setLngLat(pointAlong(d.route, d.progression, fraction));
        marker.getElement().style.backgroundColor = colorForPhase(d.phase);

        if (fraction >= 1) {
          if (d.phase === "enroute") {
            store.getState().markArrived(d.id);
          } else if (d.phase === "returning") {
            store.getState().arriveHome(d.id);
          }
        }
      }

      // Redraw the remaining-path lines (unit -> destination) for moving units.
      if (now - lastLineUpdate >= LINE_UPDATE_INTERVAL) {
        lastLineUpdate = now;
        const source = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
        if (source) {
          const features: Feature<LineString>[] = current
            .filter((d) => d.phase === "enroute" || d.phase === "returning")
            .map((d) => {
              const fraction = frac(d);
              return {
                type: "Feature",
                geometry: {
                  type: "LineString",
                  coordinates: remainingPath(d.route, d.progression, fraction),
                },
                properties: { id: d.id, phase: d.phase },
              };
            });
          source.setData({ type: "FeatureCollection", features });
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [map]);

  // Remove all markers on unmount.
  useEffect(() => {
    const markers = markersRef.current;
    return () => {
      for (const marker of markers.values()) {
        marker.remove();
      }
      markers.clear();
    };
  }, []);

  return null;
}
