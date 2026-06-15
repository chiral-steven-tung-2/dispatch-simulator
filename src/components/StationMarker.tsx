import { useEffect } from "react";
import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
import type { Station, Unit } from "../models";
import { buildStationPopupContent } from "./stationPopup";
import { chiefLevelFor, createStationElement } from "./stationMarkerElement";

interface StationMarkerProps {
  map: MapLibreMap;
  station: Station;
  units: Unit[];
  showChiefQuarters?: boolean;
  showUnitIcons?: boolean;
}

export default function StationMarker({
  map,
  station,
  units,
  showChiefQuarters = true,
  showUnitIcons = true,
}: StationMarkerProps) {
  useEffect(() => {
    const chief = chiefLevelFor(units);
    const element = createStationElement(units, showChiefQuarters, showUnitIcons);
    element.title =
      chief === "division"
        ? `${station.name} — Division HQ`
        : chief === "battalion"
        ? `${station.name} — Battalion HQ`
        : station.name;

    const popup = new Popup({ offset: 16, closeButton: true }).setDOMContent(
      buildStationPopupContent(station, units)
    );

    const marker = new Marker({ element })
      .setLngLat([station.longitude, station.latitude])
      .setPopup(popup) // clicking the marker toggles the popup
      .addTo(map);

    return () => {
      marker.remove();
      popup.remove();
    };
  }, [map, station, units, showChiefQuarters, showUnitIcons]);

  return null;
}
