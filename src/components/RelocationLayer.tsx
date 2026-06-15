import { useEffect, useRef } from "react";
import {
  Marker,
  type Map as MapLibreMap,
  type GeoJSONSource,
} from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { useRelocationStore } from "../stores/relocationStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { pointAlong, remainingPath } from "../utils/geo";
import { createMovingUnitElement } from "./movingUnitMarker";
import { GAME_CONFIG } from "../config/gameConfig";

interface RelocationLayerProps {
  map: MapLibreMap;
}

const ROUTE_SOURCE = "relocation-routes";
const ROUTE_LAYER = "relocation-routes-line";

const RELOCATING_COLOR = "#8b5cf6"; // violet

const LINE_UPDATE_INTERVAL = GAME_CONFIG.map.routeLineUpdateIntervalMs;

const EMPTY_FC: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};

/** Animates units driving between stations during a relocation/coverage move. */
export default function RelocationLayer({ map }: RelocationLayerProps) {
  const relocations = useRelocationStore((s) => s.relocations);
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
          "line-color": RELOCATING_COLOR,
          "line-width": 4,
          "line-opacity": 0.85,
          "line-dasharray": [2, 1],
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

  // Create markers for new relocations and remove completed ones.
  useEffect(() => {
    const markers = markersRef.current;
    const liveIds = new Set(relocations.map((r) => r.id));

    for (const [markerId, marker] of markers) {
      if (!liveIds.has(markerId)) {
        marker.remove();
        markers.delete(markerId);
      }
    }

    for (const r of relocations) {
      if (markers.has(r.id)) {
        continue;
      }
      const element = createMovingUnitElement(`${r.callsign} ⇄`);
      element.style.backgroundColor = RELOCATING_COLOR;
      const marker = new Marker({ element })
        .setLngLat(r.route[0] ?? [0, 0])
        .addTo(map);
      markers.set(r.id, marker);
    }
  }, [map, relocations]);

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

  // Show/hide fire vehicle markers when the toggle changes.
  useEffect(() => {
    const applyVisibility = () => {
      const show = useSettingsStore.getState().showFireVehicles;
      for (const marker of markersRef.current.values()) {
        marker.getElement().style.display = show ? "" : "none";
      }
    };
    applyVisibility();
    return useSettingsStore.subscribe(applyVisibility);
  }, []);

  // Animation loop: move markers every frame, redraw remaining paths, and fire
  // arrival transitions.
  useEffect(() => {
    let raf = 0;
    let lastLineUpdate = 0;
    const store = useRelocationStore;

    const tick = () => {
      const now = performance.now();
      const state = store.getState();
      const current = state.relocations;
      const simSpeed = useDispatchStore.getState().simSpeed;
      const frac = (r: (typeof current)[number]) =>
        Math.min(1, Math.max(0, ((now - r.startedAt) * simSpeed) / r.durationMs));

      for (const r of current) {
        const marker = markersRef.current.get(r.id);
        if (!marker) {
          continue;
        }

        const fraction = frac(r);
        marker.setLngLat(pointAlong(r.route, r.progression, fraction));

        if (fraction >= 1) {
          store.getState().arriveRelocation(r.id);
        }
      }

      // Redraw the remaining-path lines (unit -> destination) for relocating units.
      if (now - lastLineUpdate >= LINE_UPDATE_INTERVAL) {
        lastLineUpdate = now;
        const source = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
        if (source) {
          const features: Feature<LineString>[] = current.map((r) => {
            const fraction = frac(r);
            return {
              type: "Feature",
              geometry: {
                type: "LineString",
                coordinates: remainingPath(r.route, r.progression, fraction),
              },
              properties: { id: r.id },
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
