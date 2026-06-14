import { useEffect } from "react";
import { useStationStore } from "../stores/stationStore";
import { useNypdStationStore } from "../stores/nypdStationStore";
import { useUnitStore } from "../stores/unitStore";
import { useIncidentStore } from "../stores/incidentStore";

interface DispatchDataState {
  loading: boolean;
  error: string | null;
}

/**
 * Loads stations, vehicles, and calls from the backend once on mount and
 * exposes an aggregate loading/error state for the UI.
 */
export function useDispatchData(): DispatchDataState {
  const loadStations = useStationStore((s) => s.load);
  const loadNypdStations = useNypdStationStore((s) => s.load);
  const loadUnits = useUnitStore((s) => s.load);
  const loadIncidents = useIncidentStore((s) => s.load);

  const stationStatus = useStationStore((s) => s.status);
  const nypdStationStatus = useNypdStationStore((s) => s.status);
  const unitStatus = useUnitStore((s) => s.status);
  const incidentStatus = useIncidentStore((s) => s.status);

  const stationError = useStationStore((s) => s.error);
  const nypdStationError = useNypdStationStore((s) => s.error);
  const unitError = useUnitStore((s) => s.error);
  const incidentError = useIncidentStore((s) => s.error);

  useEffect(() => {
    void loadStations();
    void loadNypdStations();
    void loadUnits();
    void loadIncidents();
  }, [loadStations, loadNypdStations, loadUnits, loadIncidents]);

  const statuses = [stationStatus, nypdStationStatus, unitStatus, incidentStatus];
  const loading = statuses.some((s) => s === "loading" || s === "idle");
  const error = stationError ?? nypdStationError ?? unitError ?? incidentError;

  return { loading, error };
}
