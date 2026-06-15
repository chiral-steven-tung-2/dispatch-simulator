import { useEffect } from "react";
import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
import type { NypdStation } from "../models";
import { buildNypdStationPopupContent } from "./nypdStationPopup";
import { createNypdStationElement } from "./nypdStationMarkerElement";

interface NypdStationMarkerProps {
  map: MapLibreMap;
  station: NypdStation;
}

/** How often (real ms) to refresh the live status breakdown while a popup is open. */
const POPUP_REFRESH_MS = 2000;

export default function NypdStationMarker({ map, station }: NypdStationMarkerProps) {
  useEffect(() => {
    const element = createNypdStationElement(station);
    const popup = new Popup({ offset: 16, closeButton: true }).setDOMContent(
      buildNypdStationPopupContent(station)
    );

    let refreshId: number | undefined;
    popup.on("open", () => {
      refreshId = window.setInterval(() => {
        popup.setDOMContent(buildNypdStationPopupContent(station));
      }, POPUP_REFRESH_MS);
    });
    popup.on("close", () => {
      window.clearInterval(refreshId);
    });

    const marker = new Marker({ element })
      .setLngLat([station.longitude, station.latitude])
      .setPopup(popup)
      .addTo(map);

    return () => {
      window.clearInterval(refreshId);
      marker.remove();
      popup.remove();
    };
  }, [map, station]);

  return null;
}