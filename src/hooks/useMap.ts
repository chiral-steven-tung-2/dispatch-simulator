import { useEffect, useRef, useState, type RefObject } from "react";
import { Map as MapLibreMap, type StyleSpecification } from "maplibre-gl";

// New York City (Midtown Manhattan).
export const NYC_CENTER: [number, number] = [-73.9857, 40.7484];
export const NYC_ZOOM = 11;

// OpenFreeMap "Liberty" — free street-level vector style, no API key required.
const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

interface UseMapResult {
  containerRef: RefObject<HTMLDivElement>;
  map: MapLibreMap | null;
}

/**
 * Creates and tears down a MapLibre map instance bound to a container element.
 * Returns the map only once it has finished loading, so markers can be added safely.
 */
export function useMap(): UseMapResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const instance = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE as unknown as StyleSpecification,
      center: NYC_CENTER,
      zoom: NYC_ZOOM,
    });

    instance.on("load", () => {
      setMap(instance);
    });

    return () => {
      setMap(null);
      instance.remove();
    };
  }, []);

  return { containerRef, map };
}
