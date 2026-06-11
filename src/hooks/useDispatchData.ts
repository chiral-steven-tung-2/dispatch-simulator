import { useEffect } from "react";
import { useStationStore } from "../stores/stationStore";
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
  const loadUnits = useUnitStore((s) => s.load);
  const loadIncidents = useIncidentStore((s) => s.load);

  const stationStatus = useStationStore((s) => s.status);
  const unitStatus = useUnitStore((s) => s.status);
  const incidentStatus = useIncidentStore((s) => s.status);

  const stationError = useStationStore((s) => s.error);
  const unitError = useUnitStore((s) => s.error);
  const incidentError = useIncidentStore((s) => s.error);

  useEffect(() => {
    void loadStations();
    void loadUnits();
    void loadIncidents();
  }, [loadStations, loadUnits, loadIncidents]);

  const statuses = [stationStatus, unitStatus, incidentStatus];
  const loading = statuses.some((s) => s === "loading" || s === "idle");
  const error = stationError ?? unitError ?? incidentError;

  return { loading, error };
}
