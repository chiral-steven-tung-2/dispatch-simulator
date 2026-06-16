import type { Station, NypdStation, Unit, CallType, CallSpawnCategory, Assignment, Modifier } from "../models";

// Base URL of the C# backend. Override via VITE_API_BASE_URL if needed.
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5174";

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}`);
  }
  return (await response.json()) as T;
}

// The backend serves vehicles with the same shape as the frontend's Unit model,
// so these map across directly.
export const fetchStations = (): Promise<Station[]> =>
  getJson<Station[]>("/api/stations");

export const fetchNypdStations = (): Promise<NypdStation[]> =>
  getJson<NypdStation[]>("/api/nypd-stations");

export const fetchUnits = (): Promise<Unit[]> =>
  getJson<Unit[]>("/api/vehicles");

// Catalog of call types used to spawn random calls on the client.
export const fetchCallTypes = (): Promise<CallType[]> =>
  getJson<CallType[]>("/api/call-types");

// Category spawn probabilities used by the two-step spawn selection.
export const fetchCallSpawnCategories = (): Promise<CallSpawnCategory[]> =>
  getJson<CallSpawnCategory[]>("/api/call-spawn-categories");

// Mandatory-response assignments (staffing levels and escalation chain).
export const fetchAssignments = (): Promise<Assignment[]> =>
  getJson<Assignment[]>("/api/assignments");

// Scene modifiers — extra units that can be special-called as a fire escalates.
export const fetchModifiers = (): Promise<Modifier[]> =>
  getJson<Modifier[]>("/api/modifiers");
