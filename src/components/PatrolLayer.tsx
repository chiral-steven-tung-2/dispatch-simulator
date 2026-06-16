import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import { nypdPrecincts } from "../data/nypdPrecincts";
import { useNypdStationStore } from "../stores/nypdStationStore";
import { useNypdActivityStore, getOnAssignmentFraction } from "../stores/nypdActivityStore";
import { useSettingsStore } from "../stores/settingsStore";
import { useDispatchStore } from "../stores/dispatchStore";
import { getPrecinctUnitStatus } from "../utils/nypdPatrol";
import { fetchRoute } from "../data/routing";
import {
  buildProgressionFromSegments,
  pointAlong,
  randomPointInPolygon,
  type LngLat,
  type RouteProgression,
} from "../utils/geo";
import { GAME_CONFIG } from "../config/gameConfig";

interface PatrolLayerProps {
  map: MapLibreMap;
}

const SOURCE = "nypd-patrol-cars";
const LAYER = "nypd-patrol-cars-dots";

const PATROL_COLOR = "#1d4ed8"; // blue
const MIN_LEG_MS = GAME_CONFIG.dispatch.minLegMs;


const EMPTY: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };

/** Precomputed polygon rings for each precinct, keyed by NypdStation id. */
const polygonsByStation = new Map<string, LngLat[][][]>(
  nypdPrecincts.features.map((feature) => {
    const { geometry } = feature;
    const polygons =
      geometry.type === "Polygon"
        ? [geometry.coordinates]
        : geometry.coordinates;
    return [feature.properties.stationId, polygons as unknown as LngLat[][][]];
  })
);

interface PatrolCar {
  stationId: string;
  route: LngLat[];
  progression: RouteProgression;
  startedAt: number;
  durationMs: number;
  /** True while a street route to the next destination is being fetched. */
  pending: boolean;
}

/** A stationary placeholder shown while the next street route is being fetched. */
function idleCar(stationId: string, position: LngLat): PatrolCar {
  return {
    stationId,
    route: [position],
    progression: { cumulative: [0], total: 0 },
    startedAt: performance.now(),
    durationMs: MIN_LEG_MS,
    pending: true,
  };
}

/** Fetches a street-following route from `start` to a random point in the precinct. */
async function spawnCar(stationId: string, start: LngLat): Promise<PatrolCar> {
  const polygons = polygonsByStation.get(stationId);
  const dest = polygons ? randomPointInPolygon(polygons) : start;
  const result = await fetchRoute(start, dest);
  const progression = buildProgressionFromSegments(result.segmentDurations);
  return {
    stationId,
    route: result.coordinates,
    progression,
    startedAt: performance.now(),
    durationMs: Math.max(MIN_LEG_MS, progression.total * 1000),
    pending: false,
  };
}

/**
 * Renders the patrol cars currently "On Patrol" (per the global patrol-coverage
 * slider) as small dots that wander randomly within their precinct's boundary.
 */
export default function PatrolLayer({ map }: PatrolLayerProps) {
  const showNypdStations = useSettingsStore((s) => s.showNypdStations);
  const showPoliceVehicles = useSettingsStore((s) => s.showPoliceVehicles);

  // Add the source + layer once.
  useEffect(() => {
    if (!map.getSource(SOURCE)) {
      map.addSource(SOURCE, { type: "geojson", data: EMPTY });
    }
    if (!map.getLayer(LAYER)) {
      map.addLayer({
        id: LAYER,
        type: "circle",
        source: SOURCE,
        paint: {
          "circle-radius": 3.5,
          "circle-color": PATROL_COLOR,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });
    }

    return () => {
      if (map.getLayer(LAYER)) map.removeLayer(LAYER);
      if (map.getSource(SOURCE)) map.removeSource(SOURCE);
    };
  }, [map]);

  // Toggle visibility.
  useEffect(() => {
    if (map.getLayer(LAYER)) {
      map.setLayoutProperty(
        LAYER,
        "visibility",
        showNypdStations && showPoliceVehicles ? "visible" : "none"
      );
    }
  }, [map, showNypdStations, showPoliceVehicles]);

  // Reconcile the on-patrol fleet (driven by the slider + simulated activity)
  // and animate each car wandering its precinct.
  const carsRef = useRef<Map<string, PatrolCar>>(new Map());
  useEffect(() => {
    const cars = carsRef.current;

    const reconcile = () => {
      const stations = useNypdStationStore.getState().stations;
      const patrolPercent = useSettingsStore.getState().patrolPercent;

      const desired = new Set<string>();
      for (const station of stations) {
        const fraction = getOnAssignmentFraction(station.id);
        const status = getPrecinctUnitStatus(
          station.assignedPatrolCars,
          fraction,
          patrolPercent
        );
        for (let i = 0; i < status.onPatrol; i++) {
          desired.add(`${station.id}-${i}`);
        }
      }

      for (const id of cars.keys()) {
        if (!desired.has(id)) {
          cars.delete(id);
        }
      }
      for (const id of desired) {
        if (cars.has(id)) {
          continue;
        }
        const stationId = id.slice(0, id.lastIndexOf("-"));
        const station = stations.find((s) => s.id === stationId);
        if (!station) {
          continue;
        }
        const start: LngLat = [station.longitude, station.latitude];
        cars.set(id, idleCar(stationId, start));
        void spawnCar(stationId, start).then((car) => {
          if (cars.has(id)) {
            cars.set(id, car);
          }
        });
      }
    };

    reconcile();
    const unsubSettings = useSettingsStore.subscribe(reconcile);
    const unsubActivity = useNypdActivityStore.subscribe(reconcile);
    const unsubStations = useNypdStationStore.subscribe(reconcile);

    let raf = 0;
    const tick = () => {
      const now = performance.now();
      {
        const simSpeed = useDispatchStore.getState().simSpeed;
        const features: Feature<Point>[] = [];
        for (const [id, car] of cars) {
          const fraction = Math.min(
            1,
            ((now - car.startedAt) * simSpeed) / car.durationMs
          );
          const position = pointAlong(car.route, car.progression, fraction);
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: position },
            properties: { id },
          });

          if (fraction >= 1 && !car.pending) {
            cars.set(id, idleCar(car.stationId, position));
            void spawnCar(car.stationId, position).then((next) => {
              if (cars.has(id)) {
                cars.set(id, next);
              }
            });
          }
        }

        const source = map.getSource(SOURCE) as GeoJSONSource | undefined;
        source?.setData({ type: "FeatureCollection", features });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      unsubSettings();
      unsubActivity();
      unsubStations();
      cars.clear();
    };
  }, [map]);

  return null;
}
