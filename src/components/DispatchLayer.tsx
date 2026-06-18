import { useEffect, useRef } from "react";
import {
  Marker,
  Popup,
  type Map as MapLibreMap,
  type GeoJSONSource,
} from "maplibre-gl";
import type { Feature, FeatureCollection, LineString } from "geojson";
import { useDispatchStore } from "../stores/dispatchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useStationStore } from "../stores/stationStore";
import { useIncidentStore } from "../stores/incidentStore";
import { pointAlong, remainingPath } from "../utils/geo";
import { createMovingUnitElement, colorForPhase } from "./movingUnitMarker";
import { GAME_CONFIG } from "../config/gameConfig";
import { buildPoliceUnitPopupContent } from "./policeUnitPopup";

interface DispatchLayerProps {
  map: MapLibreMap;
}

const ROUTE_SOURCE = "dispatch-routes";
const ROUTE_LAYER = "dispatch-routes-line";

// How often (ms) to rebuild the path geometry. Markers move every frame; lines
// refresh a few times a second, which is plenty and avoids needless setData churn.
const LINE_UPDATE_INTERVAL = GAME_CONFIG.map.routeLineUpdateIntervalMs;

const EMPTY_FC: FeatureCollection<LineString> = {
  type: "FeatureCollection",
  features: [],
};

const PATROL_BLUE = "#1d4ed8";

export default function DispatchLayer({ map }: DispatchLayerProps) {
  const dispatches = useDispatchStore((s) => s.dispatches);
  const showPaths = useDispatchStore((s) => s.showPaths);
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const draggableSetup = useRef<Set<string>>(new Set());
  const policePopupRef = useRef<Popup | null>(null);

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

  // Create markers for new dispatches, remove completed ones, and keep on-scene
  // markers parked (and draggable) at their spot within the perimeter.
  useEffect(() => {
    const markers = markersRef.current;
    const liveIds = new Set(dispatches.map((d) => d.id));

    for (const [markerId, marker] of markers) {
      if (!liveIds.has(markerId)) {
        marker.remove();
        markers.delete(markerId);
        draggableSetup.current.delete(markerId);
      }
    }

    for (const d of dispatches) {
      const isPatrol = d.type === "Patrol Car";
      let marker = markers.get(d.id);
      if (!marker) {
        let element: HTMLDivElement;
        if (isPatrol) {
          element = document.createElement("div");
          element.style.cssText =
            `width:8px;height:8px;border-radius:50%;background-color:${PATROL_BLUE};border:1.5px solid rgba(255,255,255,0.8);box-shadow:0 1px 3px rgba(0,0,0,0.4);pointer-events:auto;cursor:pointer;`;
          element.addEventListener("click", () => {
            const record = useDispatchStore.getState().dispatches.find((r) => r.id === d.id);
            const m = markersRef.current.get(d.id);
            if (!record || !m) return;
            if (!policePopupRef.current) {
              policePopupRef.current = new Popup({ offset: 12, closeButton: true, maxWidth: "220px" });
            }
            const precinctName =
              useStationStore.getState().stations.find((s) => s.id === record.stationId)?.name ??
              record.stationId;
            const callName =
              useIncidentStore.getState().incidents.find((i) => i.id === record.callId)?.name ??
              record.callId;
            const status =
              record.phase === "returning"
                ? { kind: "returning" as const, precinctName }
                : { kind: "dispatched" as const, phase: record.phase, callName };
            policePopupRef.current
              .setDOMContent(buildPoliceUnitPopupContent(record.callsign, precinctName, status))
              .setLngLat(m.getLngLat())
              .addTo(map);
          });
        } else {
          element = createMovingUnitElement(d.callsign);
          element.style.backgroundColor = colorForPhase(d.phase);
        }
        marker = new Marker({ element })
          .setLngLat(d.route[0] ?? [0, 0])
          .addTo(map);
        markers.set(d.id, marker);
      }

      if (d.phase === "onScene") {
        const parked = d.parkPoint ?? d.route[d.route.length - 1] ?? [0, 0];
        const el = marker.getElement();
        marker.setLngLat(parked);
        if (!isPatrol) el.style.backgroundColor = colorForPhase(d.phase);
        el.style.cursor = "grab";
        el.style.pointerEvents = "auto";
        if (!marker.isDraggable()) {
          marker.setDraggable(true);
        }
        if (!draggableSetup.current.has(d.id)) {
          draggableSetup.current.add(d.id);
          const m = marker;
          m.on("dragend", () => {
            const { lng, lat } = m.getLngLat();
            useDispatchStore.getState().moveUnit(d.id, [lng, lat]);
          });
        }
      } else if (marker.isDraggable()) {
        marker.setDraggable(false);
        const el = marker.getElement();
        el.style.cursor = "";
        el.style.pointerEvents = "none";
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

  // Show/hide markers: FDNY follows showFireVehicles, patrol cars follow showPoliceVehicles.
  useEffect(() => {
    const applyVisibility = () => {
      const showFire = useSettingsStore.getState().showFireVehicles;
      const showPolice = useSettingsStore.getState().showPoliceVehicles;
      const currentDispatches = useDispatchStore.getState().dispatches;
      for (const [id, marker] of markersRef.current) {
        const record = currentDispatches.find((d) => d.id === id);
        const isPatrol = record?.type === "Patrol Car";
        marker.getElement().style.display = (isPatrol ? showPolice : showFire) ? "" : "none";
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
          // Parked + draggable; position is managed by the sync effect.
          continue;
        }

        if (d.phase === "dispatched") {
          // Turnout: the unit is still at quarters, getting ready to roll.
          if (d.type !== "Patrol Car")
            marker.getElement().style.backgroundColor = colorForPhase(d.phase);
          const elapsedGameMs = (now - d.startedAt) * simSpeed;
          if (elapsedGameMs >= d.turnoutMs) {
            store.getState().beginEnroute(d.id);
          }
          continue;
        }

        const fraction = frac(d);
        marker.setLngLat(pointAlong(d.route, d.progression, fraction));
        if (d.type !== "Patrol Car")
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
      policePopupRef.current?.remove();
      for (const marker of markers.values()) {
        marker.remove();
      }
      markers.clear();
    };
  }, []);

  return null;
}
