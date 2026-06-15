import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { LngLatBounds } from "maplibre-gl";
import { useMap } from "../hooks/useMap";
import { useUnitsByStation } from "../hooks/useUnitsByStation";
import { useDispatchStore } from "../stores/dispatchStore";
import { useStationStore } from "../stores/stationStore";
import { useNypdStationStore } from "../stores/nypdStationStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useIncidentStore } from "../stores/incidentStore";
import { useUnitStore } from "../stores/unitStore";
import { useRelocationStore } from "../stores/relocationStore";
import StationMarker from "./StationMarker";
import NypdStationMarker from "./NypdStationMarker";
import IncidentMarker from "./IncidentMarker";
import DispatchLayer from "./DispatchLayer";
import RelocationLayer from "./RelocationLayer";
import LandLayer from "./LandLayer";
import CallAreaLayer from "./CallAreaLayer";
import PrecinctLayer from "./PrecinctLayer";
import PatrolLayer from "./PatrolLayer";

interface MapViewProps {
  showFdnyStations: boolean;
  showNypdStations: boolean;
  showChiefQuarters: boolean;
  showUnitIcons: boolean;
}

export default function MapView({
  showFdnyStations,
  showNypdStations,
  showChiefQuarters,
  showUnitIcons,
}: MapViewProps) {
  const { containerRef, map } = useMap();
  const markerScale = useSettingsStore((s) => s.markerScale);
  const stations = useStationStore((state) => state.stations);
  const nypdStations = useNypdStationStore((state) => state.stations);
  const incidents = useIncidentStore((state) => state.incidents);
  const selectedCallId = useDispatchStore((state) => state.selectedCallId);
  const focusPoint = useDispatchStore((state) => state.focusPoint);
  const focusToken = useDispatchStore((state) => state.focusToken);
  const unitsByStation = useUnitsByStation();
  const allUnits = useUnitStore((s) => s.units);
  const relocations = useRelocationStore((s) => s.relocations);
  const hasFitted = useRef(false);

  // Fit the viewport to all markers once, when the map and data first become
  // ready. Guarded so later data changes (e.g. a call going Active on dispatch)
  // don't snap the viewport.
  useEffect(() => {
    if (!map || hasFitted.current) {
      return;
    }
    const points: [number, number][] = [
      ...stations.map((s): [number, number] => [s.longitude, s.latitude]),
      ...nypdStations.map((s): [number, number] => [s.longitude, s.latitude]),
      ...incidents.map((i): [number, number] => [i.longitude, i.latitude]),
    ];
    if (points.length === 0) {
      return;
    }
    const bounds = points.reduce(
      (acc, point) => acc.extend(point),
      new LngLatBounds(points[0], points[0])
    );
    map.fitBounds(bounds, { padding: 80, maxZoom: 13, duration: 0 });
    hasFitted.current = true;
  }, [map, stations, nypdStations, incidents]);

  // When a call is selected from a notification or marker, center the map on it.
  useEffect(() => {
    if (!map || !selectedCallId) {
      return;
    }
    const incident = incidents.find((i) => i.id === selectedCallId);
    if (!incident) {
      return;
    }
    map.flyTo({
      center: [incident.longitude, incident.latitude],
      zoom: Math.max(map.getZoom(), 13),
      essential: true,
      duration: 700,
    });
  }, [map, incidents, selectedCallId, focusToken]);

  // When a unit's quarters are searched from the navbar, center the map on it.
  useEffect(() => {
    if (!map || !focusPoint) {
      return;
    }
    map.flyTo({
      center: focusPoint,
      zoom: Math.max(map.getZoom(), 15),
      essential: true,
      duration: 700,
    });
  }, [map, focusPoint, focusToken]);

  return (
    <div className="relative h-full w-full">
      <div
          ref={containerRef}
          className="h-full w-full"
          style={{ "--marker-scale": markerScale } as React.CSSProperties}
        />

      {map && <LandLayer map={map} />}
      {map && <CallAreaLayer map={map} />}
      {map && showNypdStations && <PrecinctLayer map={map} />}
      {map && showNypdStations && <PatrolLayer map={map} />}

      {map && showFdnyStations &&
        stations.map((station) => (
          <StationMarker
            key={station.id}
            map={map}
            station={station}
            units={unitsByStation[station.id] ?? []}
            allUnits={allUnits}
            allStations={stations}
            relocations={relocations}
            showChiefQuarters={showChiefQuarters}
            showUnitIcons={showUnitIcons}
          />
        ))}

      {map && showNypdStations &&
        nypdStations.map((station) => (
          <NypdStationMarker key={station.id} map={map} station={station} />
        ))}

      {map &&
        incidents.map((incident) => (
          <IncidentMarker key={incident.id} map={map} incident={incident} />
        ))}

      {map && <DispatchLayer map={map} />}
      {map && <RelocationLayer map={map} />}
    </div>
  );
}
