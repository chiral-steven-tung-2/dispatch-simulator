import { useEffect, useRef } from "react";
import { Marker, Popup, type Map as MapLibreMap } from "maplibre-gl";
import type { Station, Unit } from "../models";
import type { RelocationRecord } from "../stores/relocationStore";
import { buildStationPopupContent } from "./stationPopup";
import { chiefLevelFor, createStationElement, updateStationElementActive } from "./stationMarkerElement";

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

const POPUP_REFRESH_MS = 1500;

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
  // Keep latest dynamic data in a ref so the popup interval always reads fresh
  // values without causing the marker to be recreated on every unit change.
  const liveRef = useRef({ units, allUnits, allStations, relocations });
  liveRef.current = { units, allUnits, allStations, relocations };

  // Ref to the marker element so the active-state effect can update it in-place.
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const { units: u, allUnits: au, allStations: as_, relocations: rel } = liveRef.current;

    const chief = chiefLevelFor(u);
    const hasUnitPresent = au.some(
      (u) => u.currentStationId === station.id && u.status === "Available"
    );
    const element = createStationElement(u, showChiefQuarters, showUnitIcons, hasUnitPresent);
    elementRef.current = element;
    element.title =
      chief === "division"
        ? `${station.name} — Division HQ`
        : chief === "battalion"
        ? `${station.name} — Battalion HQ`
        : station.name;

    const popup = new Popup({ offset: 16, closeButton: true, maxWidth: "288px" }).setDOMContent(
      buildStationPopupContent(station, u, au, as_, rel)
    );

    let refreshId: number | undefined;
    popup.on("open", () => {
      refreshId = window.setInterval(() => {
        const { units, allUnits, allStations, relocations } = liveRef.current;
        popup.setDOMContent(
          buildStationPopupContent(station, units, allUnits, allStations, relocations)
        );
      }, POPUP_REFRESH_MS);
    });
    popup.on("close", () => window.clearInterval(refreshId));

    const marker = new Marker({ element })
      .setLngLat([station.longitude, station.latitude])
      .setPopup(popup)
      .addTo(map);

    return () => {
      window.clearInterval(refreshId);
      marker.remove();
      popup.remove();
    };
    // Only recreate the marker when the station identity or display toggles change.
    // Dynamic data (units, relocations) flows through liveRef instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, station, showChiefQuarters, showUnitIcons]);

  // Update the house glyph color whenever unit availability changes, without
  // recreating the marker (which would close any open popup).
  useEffect(() => {
    if (!elementRef.current) return;
    const active = allUnits.some(
      (u) => u.currentStationId === station.id && u.status === "Available"
    );
    updateStationElementActive(elementRef.current, active);
  }, [allUnits, station.id]);

  return null;
}
