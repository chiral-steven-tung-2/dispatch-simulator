import { useEffect } from "react";
import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
import type { NypdStation } from "../models";
import { buildNypdStationPopupContent } from "./nypdStationPopup";
import { createNypdStationElement } from "./nypdStationMarkerElement";

interface NypdStationMarkerProps {
  map: MapLibreMap;
  station: NypdStation;
}

export default function NypdStationMarker({ map, station }: NypdStationMarkerProps) {
  useEffect(() => {
    const element = createNypdStationElement(station);
    const popup = new Popup({ offset: 16, closeButton: true }).setDOMContent(
      buildNypdStationPopupContent(station)
    );

    const marker = new Marker({ element })
      .setLngLat([station.longitude, station.latitude])
      .setPopup(popup)
      .addTo(map);

    return () => {
      marker.remove();
      popup.remove();
    };
  }, [map, station]);

  return null;
}