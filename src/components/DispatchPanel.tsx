import { useMemo, useState, useEffect, useReducer } from "react";
import {
  useDispatchStore,
  type DispatchRecord,
  remainingArrivalMs,
  dispatchCurrentPoint,
} from "../stores/dispatchStore";
import {
  useRelocationStore,
  relocationCurrentPoint,
} from "../stores/relocationStore";
import { useIncidentStore } from "../stores/incidentStore";
import { useUnitStore } from "../stores/unitStore";
import { useStationStore } from "../stores/stationStore";
import { haversineMeters, formatDistance, type LngLat } from "../utils/geo";
import { remainingResolveMs, formatGameDuration } from "../utils/resolve";
import {
  countOnSceneByCategory,
  CATEGORY_LABELS,
  REQUIREMENT_KEYS,
} from "../utils/assignment";
import type { Assignment, Incident } from "../models";
import { statusColor } from "./unitDisplay";
import { colorForPhase, phaseLabel } from "./movingUnitMarker";

interface AvailableUnit {
  id: string;
  callsign: string;
  type: string;
  /** Where the unit is now: its quarters, or its current movement. */
  locationLabel: string;
  /** Status dot color reflecting how the unit is currently moving (if at all). */
  dotColor: string;
  distanceMeters: number;
}

export default function DispatchPanel() {
  const selectedCallId = useDispatchStore((s) => s.selectedCallId);
  const clearSelection = useDispatchStore((s) => s.clearSelection);
  const dispatchUnits = useDispatchStore((s) => s.dispatchUnits);
  const returnToQuarters = useDispatchStore((s) => s.returnToQuarters);
  const dispatching = useDispatchStore((s) => s.dispatching);
  const dispatches = useDispatchStore((s) => s.dispatches);
  const simSpeed = useDispatchStore((s) => s.simSpeed);

  const incidents = useIncidentStore((s) => s.incidents);
  const units = useUnitStore((s) => s.units);
  const stations = useStationStore((s) => s.stations);
  const relocations = useRelocationStore((s) => s.relocations);

  // Re-render once a second so responding-unit ETAs stay live.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!selectedCallId) {
      return;
    }
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [selectedCallId]);

  const assignments = useIncidentStore((s) => s.assignments);

  const call = incidents.find((i) => i.id === selectedCallId) ?? null;
  const assignment = call
    ? assignments.find((a) => a.id === call.assignmentId)
    : null;

  // Units already working this call (dispatched, en route, or on scene).
  const assigned = useMemo(
    () =>
      dispatches
        .filter(
          (d) =>
            d.callId === selectedCallId &&
            (d.phase === "dispatched" || d.phase === "enroute" || d.phase === "onScene")
        )
        .sort((a, b) => (a.phase === b.phase ? 0 : a.phase === "onScene" ? -1 : 1)),
    [dispatches, selectedCallId]
  );

  const available = useMemo<AvailableUnit[]>(() => {
    if (!call) {
      return [];
    }
    const target: LngLat = [call.longitude, call.latitude];
    const stationName = (id: string) =>
      stations.find((s) => s.id === id)?.name ?? id;
    const result: AvailableUnit[] = [];
    for (const unit of units) {
      const dispatch = dispatches.find((d) => d.unitId === unit.id);
      // A unit actively working a call (turnout, en route, or on scene) is busy.
      if (dispatch && dispatch.phase !== "returning") {
        continue;
      }

      let from: LngLat;
      let locationLabel: string;
      let dotColor: string;

      if (dispatch && dispatch.phase === "returning") {
        from = dispatchCurrentPoint(dispatch, simSpeed);
        locationLabel = "Returning to quarters";
        dotColor = colorForPhase("returning");
      } else {
        const relocation = relocations.find((r) => r.unitId === unit.id);
        if (relocation) {
          from = relocationCurrentPoint(relocation, simSpeed);
          locationLabel = `Relocating → ${stationName(relocation.toStationId)}`;
          dotColor = statusColor("Relocating");
        } else if (unit.status === "Available") {
          const station = stations.find((s) => s.id === unit.currentStationId);
          if (!station) {
            continue;
          }
          from = [station.longitude, station.latitude];
          locationLabel = station.name;
          dotColor = statusColor("Available");
        } else {
          continue;
        }
      }

      result.push({
        id: unit.id,
        callsign: unit.callsign,
        type: unit.type,
        locationLabel,
        dotColor,
        distanceMeters: haversineMeters(from, target),
      });
    }
    return result.sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [call, units, stations, dispatches, relocations, simSpeed]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [unitSearch, setUnitSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  // Reset the selection and filters whenever the active call changes.
  useEffect(() => {
    setSelected(new Set());
    setUnitSearch("");
    setTypeFilter(null);
  }, [selectedCallId]);

  const availableTypes = useMemo(() => {
    const types = new Set(available.map((u) => u.type));
    return [...types].sort();
  }, [available]);

  const filteredAvailable = useMemo(() => {
    const query = unitSearch.trim().toLowerCase();
    return available.filter((unit) => {
      if (typeFilter && unit.type !== typeFilter) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        unit.callsign.toLowerCase().includes(query) ||
        unit.type.toLowerCase().includes(query) ||
        unit.locationLabel.toLowerCase().includes(query)
      );
    });
  }, [available, unitSearch, typeFilter]);

  if (!call) {
    return null;
  }

  const toggle = (unitId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) {
        next.delete(unitId);
      } else {
        next.add(unitId);
      }
      return next;
    });
  };

  const allSelected =
    filteredAvailable.length > 0 &&
    filteredAvailable.every((u) => selected.has(u.id));
  const toggleAll = () =>
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        for (const u of filteredAvailable) {
          next.delete(u.id);
        }
        return next;
      }
      return new Set([...prev, ...filteredAvailable.map((u) => u.id)]);
    });

  const onDispatch = () => {
    const toSend = units.filter((u) => selected.has(u.id));
    void dispatchUnits(call, toSend);
  };

  return (
    <div className="fixed inset-0 z-20 flex justify-start">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={clearSelection}
        aria-hidden="true"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-slate-800 text-slate-100 shadow-xl">
        <header className="border-b border-slate-700 px-5 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold">Dispatch to call</h2>
              <p className="text-sm text-slate-300">{call.name}</p>
              <p className="text-xs text-slate-400">Status: {call.status}</p>
              {assignment && (
                <p className="text-xs font-medium text-amber-400">
                  Assignment: {assignment.name}
                  {call.assignmentMetAt == null && call.status === "Active" && (
                    <span className="ml-1 text-slate-400">
                      · awaiting full assignment
                    </span>
                  )}
                </p>
              )}
              {assignment && (
                <AssignmentStaffing assignment={assignment} units={assigned} />
              )}
              <ResolveCountdown call={call} />
            </div>
            <button
              onClick={clearSelection}
              className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white"
              aria-label="Close dispatch panel"
            >
              ✕
            </button>
          </div>
        </header>

        {assigned.length > 0 && (
          <section className="max-h-48 shrink-0 overflow-y-auto border-b border-slate-700 px-5 py-3">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Responding ({assigned.length})
            </h3>
            <ul className="space-y-1.5">
              {assigned.map((d) => (
                <AssignedRow
                  key={d.id}
                  record={d}
                  simSpeed={simSpeed}
                  busy={dispatching}
                  onReturn={() => void returnToQuarters(d.id)}
                />
              ))}
            </ul>
          </section>
        )}

        <div className="border-b border-slate-700 px-5 py-2">
          <input
            type="text"
            value={unitSearch}
            onChange={(e) => setUnitSearch(e.target.value)}
            placeholder="Search units by callsign, type, or station…"
            className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
          />
          {availableTypes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <button
                onClick={() => setTypeFilter(null)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                  typeFilter === null
                    ? "border-amber-500 bg-amber-500/10 text-amber-400"
                    : "border-slate-600 text-slate-300 hover:bg-slate-700"
                }`}
              >
                All
              </button>
              {availableTypes.map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    setTypeFilter((prev) => (prev === type ? null : type))
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                    typeFilter === type
                      ? "border-amber-500 bg-amber-500/10 text-amber-400"
                      : "border-slate-600 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-2 text-xs text-slate-400">
          <span>
            {filteredAvailable.length} available · sorted by distance to call
          </span>
          {filteredAvailable.length > 0 && (
            <button onClick={toggleAll} className="underline hover:text-white">
              {allSelected ? "Clear all" : "Select all"}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {filteredAvailable.length === 0 ? (
            <p className="p-4 text-sm italic text-slate-500">
              {available.length === 0
                ? "No available units to dispatch."
                : "No units match your search."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filteredAvailable.map((unit) => {
                const isSelected = selected.has(unit.id);
                return (
                  <li key={unit.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 ${
                        isSelected
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-slate-700 hover:bg-slate-700/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(unit.id)}
                        className="h-4 w-4 accent-amber-500"
                      />
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: unit.dotColor }}
                      />
                      <span className="flex-1">
                        <span className="font-medium">{unit.callsign}</span>
                        <span className="text-slate-400"> · {unit.type}</span>
                        <span className="block text-xs text-slate-500">
                          {unit.locationLabel}
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-slate-300">
                        {formatDistance(unit.distanceMeters)}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="border-t border-slate-700 p-4">
          <button
            onClick={onDispatch}
            disabled={selected.size === 0 || dispatching}
            className="w-full rounded-md bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-500 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
          >
            {dispatching
              ? "Routing…"
              : `Dispatch ${selected.size} unit${selected.size === 1 ? "" : "s"}`}
          </button>
        </footer>
      </aside>
    </div>
  );
}

/** Shows on-scene unit counts vs. the current assignment's requirements, e.g. "1/2 Engines". */
function AssignmentStaffing({
  assignment,
  units,
}: {
  assignment: Assignment;
  units: DispatchRecord[];
}) {
  const onScene = units.filter((u) => u.phase === "onScene");
  const counts = countOnSceneByCategory(onScene);
  const requirements = REQUIREMENT_KEYS.filter((key) => assignment[key] > 0);

  if (requirements.length === 0) {
    return null;
  }

  return (
    <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-400">
      {requirements.map((key) => {
        const have = counts[key] ?? 0;
        const need = assignment[key];
        const met = have >= need;
        return (
          <span key={key} className={met ? "text-emerald-400" : "text-slate-400"}>
            {have}/{need} {CATEGORY_LABELS[key]}
          </span>
        );
      })}
    </p>
  );
}

function ResolveCountdown({ call }: { call: Incident }) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const resolving = call.resolveStartedAt != null && call.status !== "Resolved";

  useEffect(() => {
    if (!resolving) {
      return;
    }
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [resolving]);

  if (call.resolveStartedAt == null || call.status === "Resolved") {
    return null;
  }
  const simSpeed = useDispatchStore.getState().simSpeed;
  const remaining = remainingResolveMs(call.resolveStartedAt, simSpeed);
  return (
    <p className="mt-1 text-xs font-semibold text-sky-400">
      ⏱ Resolving in {formatGameDuration(remaining)}
    </p>
  );
}

function AssignedRow({
  record,
  simSpeed,
  busy,
  onReturn,
}: {
  record: DispatchRecord;
  simSpeed: number;
  busy: boolean;
  onReturn: () => void;
}) {
  const onScene = record.phase === "onScene";
  const label = phaseLabel(record.phase);
  const arrival = formatArrival(record, simSpeed);
  return (
    <li className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/40 px-3 py-2 text-sm">
      <span
        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: colorForPhase(record.phase) }}
        title={label}
      />
      <span className="flex-1">
        <span className="font-medium">{record.callsign}</span>
        <span className="text-slate-400"> · {record.type}</span>
        <span className="block text-xs text-slate-500">{label}</span>
        <span className="block text-xs text-slate-400">{arrival}</span>
      </span>
      <button
        onClick={onReturn}
        disabled={busy}
        className="rounded border border-slate-600 px-2 py-1 text-xs hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {onScene ? "Return to quarters" : "Cancel"}
      </button>
    </li>
  );
}

function formatArrival(record: DispatchRecord, simSpeed: number): string {
  const remaining = remainingArrivalMs(record, simSpeed);
  if (remaining == null) {
    return "";
  }
  return remaining <= 0 ? "On scene" : `Arrives in ${formatGameDuration(remaining)}`;
}
