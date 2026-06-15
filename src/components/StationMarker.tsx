import { useEffect } from "react";
import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
import type { Station, Unit } from "../models";
import type { RelocationRecord } from "../stores/relocationStore";
import { buildStationPopupContent } from "./stationPopup";
import { chiefLevelFor, createStationElement } from "./stationMarkerElement";

interface StationMarkerProps {
  map: MapLibreMap;
  station: Station;
  units: Unit[];
  allUnits: Unit[];
  allStations: Station[];
  relocations: RelocationRecord[];
  showChiefQuarters?: boolean;
  showUnitIcons?: boolean;
}

export default function StationMarker({
  map,
  station,
  units,
  allUnits,
  allStations,
  relocations,
  showChiefQuarters = true,
  showUnitIcons = true,
}: StationMarkerProps) {
  useEffect(() => {
    const chief = chiefLevelFor(units);
    // The house shows "active" (red) while any unit is actually parked here —
    // its own rigs or a guest covering it. Units out on a call or relocating
    // don't count; an empty house is grayed.
    const hasUnitPresent = allUnits.some(
      (u) => u.currentStationId === station.id && u.status === "Available"
    );
    const element = createStationElement(
      units,
      showChiefQuarters,
      showUnitIcons,
      hasUnitPresent
    );
    element.title =
      chief === "division"
        ? `${station.name} — Division HQ`
        : chief === "battalion"
        ? `${station.name} — Battalion HQ`
        : station.name;

    const popup = new Popup({ offset: 16, closeButton: true, maxWidth: "288px" }).setDOMContent(
      buildStationPopupContent(station, units, allUnits, allStations, relocations)
    );

    const marker = new Marker({ element })
      .setLngLat([station.longitude, station.latitude])
      .setPopup(popup) // clicking the marker toggles the popup
      .addTo(map);

    return () => {
      marker.remove();
      popup.remove();
    };
  }, [map, station, units, allUnits, allStations, relocations, showChiefQuarters, showUnitIcons]);

  return null;
}
