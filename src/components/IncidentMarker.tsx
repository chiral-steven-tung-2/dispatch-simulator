import { useEffect, useRef } from "react";
import { Marker, type Map as MapLibreMap } from "maplibre-gl";
import type { Incident, IncidentStatus } from "../models";
import { createCircleElement } from "./markerElement";
import { useDispatchStore } from "../stores/dispatchStore";
import { useIncidentStore } from "../stores/incidentStore";
import { remainingResolveMs, formatGameDuration } from "../utils/resolve";

interface IncidentMarkerProps {
  map: MapLibreMap;
  incident: Incident;
}

function incidentColor(status: IncidentStatus): string {
  switch (status) {
    case "Waiting":
      return "#dc2626"; // red — needs units
    case "Active":
      return "#f59e0b"; // amber — units dispatched/on scene
    case "Resolved":
      return "#64748b"; // slate
    default:
      return "#dc2626";
  }
}

function createCountdownBadge(): HTMLDivElement {
  const badge = document.createElement("div");
  badge.style.position = "absolute";
  badge.style.bottom = "120%";
  badge.style.left = "50%";
  badge.style.transform = "translateX(-50%)";
  badge.style.padding = "1px 5px";
  badge.style.fontSize = "10px";
  badge.style.fontWeight = "700";
  badge.style.lineHeight = "14px";
  badge.style.color = "white";
  badge.style.whiteSpace = "nowrap";
  badge.style.borderRadius = "4px";
  badge.style.backgroundColor = "rgba(2, 132, 199, 0.92)"; // sky-600
  badge.style.boxShadow = "0 1px 3px rgba(0,0,0,0.5)";
  badge.style.pointerEvents = "none";
  badge.style.display = "none";
  return badge;
}

export default function IncidentMarker({ map, incident }: IncidentMarkerProps) {
  const focusCall = useDispatchStore((s) => s.focusCall);
  const badgeRef = useRef<HTMLDivElement | null>(null);

  // Create/replace the marker only on meaningful changes (not every countdown
  // tick). resolveStartedAt is intentionally excluded from the deps.
  useEffect(() => {
    const element = createCircleElement(incidentColor(incident.status), 18);
    element.title = `${incident.name} — ${incident.status} (click to dispatch)`;

    const badge = createCountdownBadge();
    element.appendChild(badge);
    badgeRef.current = badge;

    const onClick = (event: MouseEvent) => {
      event.stopPropagation();
      focusCall(incident.id);
    };
    element.addEventListener("click", onClick);

    const marker = new Marker({ element })
      .setLngLat([incident.longitude, incident.latitude])
      .addTo(map);

    return () => {
      element.removeEventListener("click", onClick);
      marker.remove();
      badgeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    incident.id,
    incident.status,
    incident.latitude,
    incident.longitude,
    incident.name,
    focusCall,
  ]);

  // Live countdown: update the badge text on an interval, reading the latest
  // timer + sim-speed from the stores.
  useEffect(() => {
    const update = () => {
      const badge = badgeRef.current;
      if (!badge) {
        return;
      }
      const current = useIncidentStore
        .getState()
        .incidents.find((i) => i.id === incident.id);
      if (
        !current ||
        current.resolveStartedAt == null ||
        current.status === "Resolved"
      ) {
        badge.style.display = "none";
        return;
      }
      const simSpeed = useDispatchStore.getState().simSpeed;
      const remaining = remainingResolveMs(current.resolveStartedAt, simSpeed);
      badge.textContent = `⏱ ${formatGameDuration(remaining)}`;
      badge.style.display = "block";
    };

    update();
    const id = window.setInterval(update, 250);
    return () => window.clearInterval(id);
  }, [incident.id]);

  return null;
}
