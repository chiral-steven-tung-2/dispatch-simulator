import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { LngLatBounds } from "maplibre-gl";
import { useMap } from "../hooks/useMap";
import { useUnitsByStation } from "../hooks/useUnitsByStation";
import { useStationStore } from "../stores/stationStore";
import { useNypdStationStore } from "../stores/nypdStationStore";
import { useIncidentStore } from "../stores/incidentStore";
import StationMarker from "./StationMarker";
import NypdStationMarker from "./NypdStationMarker";
import IncidentMarker from "./IncidentMarker";
import DispatchLayer from "./DispatchLayer";
import LandLayer from "./LandLayer";
import CallAreaLayer from "./CallAreaLayer";

export default function MapView() {
  const { containerRef, map } = useMap();
  const stations = useStationStore((state) => state.stations);
  const nypdStations = useNypdStationStore((state) => state.stations);
  const incidents = useIncidentStore((state) => state.incidents);
  const unitsByStation = useUnitsByStation();
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

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      {map && <LandLayer map={map} />}
      {map && <CallAreaLayer map={map} />}

      {map &&
        stations.map((station) => (
          <StationMarker
            key={station.id}
            map={map}
            station={station}
            units={unitsByStation[station.id] ?? []}
          />
        ))}

      {map &&
        nypdStations.map((station) => (
          <NypdStationMarker key={station.id} map={map} station={station} />
        ))}

      {map &&
        incidents.map((incident) => (
          <IncidentMarker key={incident.id} map={map} incident={incident} />
        ))}

      {map && <DispatchLayer map={map} />}
    </div>
  );
}
