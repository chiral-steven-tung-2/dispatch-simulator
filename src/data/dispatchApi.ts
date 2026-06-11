import type { Station, Unit, CallType } from "../models";

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

export const fetchUnits = (): Promise<Unit[]> =>
  getJson<Unit[]>("/api/vehicles");

// Catalog of call types used to spawn random calls on the client.
export const fetchCallTypes = (): Promise<CallType[]> =>
  getJson<CallType[]>("/api/call-types");
