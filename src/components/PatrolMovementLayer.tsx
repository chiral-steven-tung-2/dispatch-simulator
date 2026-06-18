import { useEffect, useRef } from "react";
import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
import { usePatrolStore } from "../stores/patrolStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useStationStore } from "../stores/stationStore";
import { pointAlong } from "../utils/geo";
import { buildPoliceUnitPopupContent } from "./policeUnitPopup";

interface PatrolMovementLayerProps {
  map: MapLibreMap;
}

const PATROL_BLUE = "#1d4ed8";

function createPatrolElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.width = "8px";
  el.style.height = "8px";
  el.style.borderRadius = "50%";
  el.style.backgroundColor = PATROL_BLUE;
  el.style.border = "1.5px solid rgba(255,255,255,0.8)";
  el.style.boxShadow = "0 1px 3px rgba(0,0,0,0.4)";
  el.style.pointerEvents = "auto";
  el.style.cursor = "pointer";
  return el;
}

export default function PatrolMovementLayer({ map }: PatrolMovementLayerProps) {
  const markersRef = useRef<globalThis.Map<string, Marker>>(new globalThis.Map());
  const popupRef = useRef<Popup | null>(null);

  // Sync the marker set with the patrol records.
  useEffect(() => {
    const getPopup = () => {
      if (!popupRef.current) {
        popupRef.current = new Popup({ offset: 12, closeButton: true, maxWidth: "220px" });
      }
      return popupRef.current;
    };

    const syncMarkers = () => {
      const records = usePatrolStore.getState().records;
      const markers = markersRef.current;
      const liveIds = new Set(records.map((r) => r.unitId));

      for (const [id, marker] of markers) {
        if (!liveIds.has(id)) {
          marker.remove();
          markers.delete(id);
        }
      }

      for (const r of records) {
        if (!markers.has(r.unitId)) {
          const el = createPatrolElement();

          el.addEventListener("click", () => {
            const record = usePatrolStore.getState().records.find((rec) => rec.unitId === r.unitId);
            if (!record) return;
            const marker = markers.get(r.unitId);
            if (!marker) return;

            const precinctName =
              useStationStore.getState().stations.find((s) => s.id === record.stationId)?.name ??
              record.stationId;

            const content = buildPoliceUnitPopupContent(record.callsign, precinctName, {
              kind: "patrol",
            });

            getPopup().setDOMContent(content).setLngLat(marker.getLngLat()).addTo(map);
          });

          const startPos = r.needsNextLeg ? r.currentPosition : (r.route[0] ?? r.currentPosition);
          const marker = new Marker({ element: el }).setLngLat(startPos).addTo(map);
          markers.set(r.unitId, marker);
        }
      }
    };

    syncMarkers();
    const unsub = usePatrolStore.subscribe(syncMarkers);

    return () => {
      unsub();
      popupRef.current?.remove();
      for (const m of markersRef.current.values()) m.remove();
      markersRef.current.clear();
    };
  }, [map]);

  // Apply visibility setting.
  useEffect(() => {
    const applyVisibility = () => {
      const show =
        useSettingsStore.getState().showNypdStations &&
        useSettingsStore.getState().showPoliceVehicles;
      for (const marker of markersRef.current.values()) {
        marker.getElement().style.display = show ? "" : "none";
      }
    };
    applyVisibility();
    return useSettingsStore.subscribe(applyVisibility);
  }, []);

  // Animation loop: move markers along their routed patrol legs.
  useEffect(() => {
    let raf = 0;

    const tick = () => {
      const records = usePatrolStore.getState().records;
      const simSpeed = useDispatchStore.getState().simSpeed;
      const now = performance.now();

      for (const r of records) {
        const marker = markersRef.current.get(r.unitId);
        if (!marker) continue;

        if (r.needsNextLeg) {
          marker.setLngLat(r.currentPosition);
          continue;
        }

        const elapsed = (now - r.startedAt) * simSpeed;
        const t = elapsed / r.durationMs;

        if (t >= 1) {
          marker.setLngLat(r.route[r.route.length - 1] ?? r.currentPosition);
          usePatrolStore.getState().completeLeg(r.unitId);
        } else {
          marker.setLngLat(pointAlong(r.route, r.progression, t));
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return null;
}
