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
  effectiveNeed,
  CATEGORY_LABELS,
  REQUIREMENT_KEYS,
} from "../utils/assignment";
import type { Assignment, AssignmentRequirements, Incident } from "../models";
import { statusColor } from "./unitDisplay";
import { colorForPhase, phaseLabel } from "./movingUnitMarker";
import { usePatrolStore } from "../stores/patrolStore";

type Agency = "fdny" | "nypd";

interface FireUnit {
  id: string;
  callsign: string;
  type: string;
  locationLabel: string;
  dotColor: string;
  distanceMeters: number;
}


export default function DispatchPanel() {
  const selectedCallId = useDispatchStore((s) => s.selectedCallId);
  const clearSelection = useDispatchStore((s) => s.clearSelection);
  const dispatchUnits = useDispatchStore((s) => s.dispatchUnits);
  const dispatchForCall = useDispatchStore((s) => s.dispatchForCall);
  const returnToQuarters = useDispatchStore((s) => s.returnToQuarters);
  const dispatching = useDispatchStore((s) => s.dispatching);
  const dispatches = useDispatchStore((s) => s.dispatches);
  const simSpeed = useDispatchStore((s) => s.simSpeed);

  const incidents = useIncidentStore((s) => s.incidents);
  const assignments = useIncidentStore((s) => s.assignments);
  const units = useUnitStore((s) => s.units);
  const stations = useStationStore((s) => s.stations);
  const relocations = useRelocationStore((s) => s.relocations);
  const patrolRecords = usePatrolStore((s) => s.records);

  const [agency, setAgency] = useState<Agency>("fdny");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectedNypd, setSelectedNypd] = useState<Set<string>>(new Set());
  const [unitSearch, setUnitSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);

  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!selectedCallId) return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [selectedCallId]);

  const call = incidents.find((i) => i.id === selectedCallId) ?? null;
  const assignment = call
    ? assignments.find((a) => a.id === call.assignmentId)
    : null;

  // FDNY units already working this call.
  const assigned = useMemo(
    () =>
      dispatches
        .filter(
          (d) =>
            d.callId === selectedCallId &&
            (d.phase === "dispatched" ||
              d.phase === "enroute" ||
              d.phase === "onScene")
        )
        .sort((a, b) =>
          a.phase === b.phase ? 0 : a.phase === "onScene" ? -1 : 1
        ),
    [dispatches, selectedCallId]
  );

  const totalPersonnel = useMemo(
    () =>
      assigned.reduce((sum, d) => {
        const unit = units.find((u) => u.id === d.unitId);
        return sum + (unit?.ffCount ?? 0);
      }, 0),
    [assigned, units]
  );

  // Available FDNY units sorted by distance.
  const fireAvailable = useMemo<FireUnit[]>(() => {
    if (!call) return [];
    const target: LngLat = [call.longitude, call.latitude];
    const stationName = (id: string) =>
      stations.find((s) => s.id === id)?.name ?? id;
    const result: FireUnit[] = [];
    for (const unit of units) {
      if (unit.type === "Patrol Car") continue;
      const dispatch = dispatches.find((d) => d.unitId === unit.id);
      if (dispatch && dispatch.phase !== "returning") continue;

      let from: LngLat;
      let locationLabel: string;
      let dotColor: string;

      if (dispatch?.phase === "returning") {
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
          if (!station) continue;
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

  // Available NYPD patrol car units sorted by distance.
  const policeAvailable = useMemo<FireUnit[]>(() => {
    if (!call) return [];
    const target: LngLat = [call.longitude, call.latitude];
    const result: FireUnit[] = [];
    for (const unit of units) {
      if (unit.type !== "Patrol Car") continue;
      const dispatch = dispatches.find((d) => d.unitId === unit.id);
      if (dispatch && dispatch.phase !== "returning") continue;

      let from: LngLat;
      let locationLabel: string;
      let dotColor: string;

      if (dispatch?.phase === "returning") {
        from = dispatchCurrentPoint(dispatch, simSpeed);
        locationLabel = "Returning to quarters";
        dotColor = colorForPhase("returning");
      } else if (unit.status === "Available") {
        const patrolPos = usePatrolStore.getState().getCurrentPoint(unit.id, simSpeed);
        if (patrolPos) {
          from = patrolPos;
          locationLabel = "On Patrol";
          dotColor = statusColor("Available");
        } else {
          const station = stations.find((s) => s.id === unit.currentStationId);
          if (!station) continue;
          from = [station.longitude, station.latitude];
          locationLabel = station.name;
          dotColor = statusColor("Available");
        }
      } else {
        continue;
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
  }, [call, units, stations, dispatches, simSpeed, patrolRecords]);

  const availableTypes = useMemo(
    () => [...new Set(fireAvailable.map((u) => u.type))].sort(),
    [fireAvailable]
  );

  const filteredFire = useMemo(() => {
    const query = unitSearch.trim().toLowerCase();
    return fireAvailable.filter((u) => {
      if (typeFilter && u.type !== typeFilter) return false;
      if (!query) return true;
      return (
        u.callsign.toLowerCase().includes(query) ||
        u.type.toLowerCase().includes(query) ||
        u.locationLabel.toLowerCase().includes(query)
      );
    });
  }, [fireAvailable, unitSearch, typeFilter]);

  const filteredPolice = useMemo(() => {
    const query = unitSearch.trim().toLowerCase();
    return policeAvailable.filter((u) => {
      if (!query) return true;
      return (
        u.callsign.toLowerCase().includes(query) ||
        u.type.toLowerCase().includes(query) ||
        u.locationLabel.toLowerCase().includes(query)
      );
    });
  }, [policeAvailable, unitSearch]);

  // Reset all state when the selected call changes.
  useEffect(() => {
    setSelected(new Set());
    setSelectedNypd(new Set());
    setUnitSearch("");
    setTypeFilter(null);
    setAgency("fdny");
  }, [selectedCallId]);

  if (!call) return null;

  const toggleFire = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleNypd = (id: string) =>
    setSelectedNypd((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allFireSelected =
    filteredFire.length > 0 && filteredFire.every((u) => selected.has(u.id));
  const toggleAllFire = () =>
    setSelected((prev) => {
      if (allFireSelected) {
        const next = new Set(prev);
        filteredFire.forEach((u) => next.delete(u.id));
        return next;
      }
      return new Set([...prev, ...filteredFire.map((u) => u.id)]);
    });

  const allPoliceSelected =
    filteredPolice.length > 0 &&
    filteredPolice.every((u) => selectedNypd.has(u.id));
  const toggleAllPolice = () =>
    setSelectedNypd((prev) => {
      if (allPoliceSelected) {
        const next = new Set(prev);
        filteredPolice.forEach((u) => next.delete(u.id));
        return next;
      }
      return new Set([...prev, ...filteredPolice.map((u) => u.id)]);
    });

  const onDispatchFire = () => {
    const toSend = units.filter((u) => selected.has(u.id));
    void dispatchUnits(call, toSend);
    setSelected(new Set());
  };

  const onDispatchNypd = () => {
    const toSend = units.filter((u) => selectedNypd.has(u.id));
    void dispatchUnits(call, toSend);
    setSelectedNypd(new Set());
  };

  const currentList = agency === "fdny" ? filteredFire : filteredPolice;
  const currentSelectedCount =
    agency === "fdny" ? selected.size : selectedNypd.size;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={clearSelection}
        aria-hidden="true"
      />

      {/* MDT Window */}
      <div className="relative flex h-[680px] max-h-[90vh] w-[980px] max-w-[96vw] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-950 shadow-2xl">

        {/* ── Header bar ── */}
        <header className="flex shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-5 py-3">
          <div className="flex items-center gap-4">
            <span className="font-mono text-xs font-bold text-slate-500 tracking-widest">
              NYC DISPATCH MDT
            </span>
            <span className="h-4 w-px bg-slate-700" />
            <span className="font-semibold text-white">{call.name}</span>
            <CallStatusChip status={call.status} />
          </div>
          <button
            onClick={clearSelection}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-700 hover:text-white"
            aria-label="Close"
          >
            <XIcon />
          </button>
        </header>

        {/* ── Body ── */}
        <div className="flex flex-1 min-h-0">

          {/* ─── Left column: agency tabs + unit list ─── */}
          <div className="flex w-72 shrink-0 flex-col border-r border-slate-800">

            {/* Agency tab strip */}
            <div className="flex shrink-0 border-b border-slate-800">
              <AgencyTab
                active={agency === "fdny"}
                onClick={() => { setAgency("fdny"); setUnitSearch(""); setTypeFilter(null); }}
                color="red"
                label="FDNY"
              />
              <AgencyTab
                active={agency === "nypd"}
                onClick={() => { setAgency("nypd"); setUnitSearch(""); setTypeFilter(null); }}
                color="blue"
                label="NYPD"
              />
            </div>

            {/* Search */}
            <div className="shrink-0 border-b border-slate-800 p-2">
              <input
                type="text"
                value={unitSearch}
                onChange={(e) => setUnitSearch(e.target.value)}
                placeholder={agency === "fdny" ? "Search callsign or type…" : "Search callsign or location…"}
                className="w-full rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-slate-500 focus:outline-none"
              />
            </div>

            {/* Fire type filter chips */}
            {agency === "fdny" && availableTypes.length > 0 && (
              <div className="shrink-0 flex flex-wrap gap-1 border-b border-slate-800 px-2 py-1.5">
                <TypeChip active={typeFilter === null} onClick={() => setTypeFilter(null)} label="All" />
                {availableTypes.map((t) => (
                  <TypeChip
                    key={t}
                    active={typeFilter === t}
                    onClick={() => setTypeFilter((prev) => (prev === t ? null : t))}
                    label={t}
                  />
                ))}
              </div>
            )}

            {/* Select-all row */}
            <div className="flex shrink-0 items-center justify-between border-b border-slate-800 px-3 py-1.5 text-xs text-slate-500">
              <span>
                {agency === "fdny"
                  ? `${filteredFire.length} available`
                  : `${filteredPolice.length} available`}
                {" · "}by distance
              </span>
              {currentList.length > 0 && (
                <button
                  onClick={agency === "fdny" ? toggleAllFire : toggleAllPolice}
                  className="text-slate-400 underline hover:text-white"
                >
                  {(agency === "fdny" ? allFireSelected : allPoliceSelected)
                    ? "Clear all"
                    : "Select all"}
                </button>
              )}
            </div>

            {/* Unit / precinct list */}
            <div className="flex-1 overflow-y-auto p-2">
              {agency === "fdny" ? (
                <FireUnitList
                  units={filteredFire}
                  selected={selected}
                  onToggle={toggleFire}
                />
              ) : (
                <FireUnitList
                  units={filteredPolice}
                  selected={selectedNypd}
                  onToggle={toggleNypd}
                  accent="blue"
                />
              )}
            </div>

            {/* Dispatch / notify footer */}
            <div className="shrink-0 border-t border-slate-800 p-2 space-y-1.5">
              {agency === "fdny" ? (
                <>
                  <button
                    onClick={onDispatchFire}
                    disabled={selected.size === 0 || dispatching}
                    className="w-full rounded bg-red-700 px-3 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
                  >
                    {dispatching
                      ? "Routing…"
                      : selected.size === 0
                      ? "Select units to dispatch"
                      : `Dispatch ${selected.size} unit${selected.size === 1 ? "" : "s"}`}
                  </button>
                  {selectedCallId && (
                    <button
                      onClick={() => void dispatchForCall(selectedCallId)}
                      disabled={dispatching}
                      className="w-full rounded border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ⚡ Quick-staff assignment
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={onDispatchNypd}
                  disabled={selectedNypd.size === 0 || dispatching}
                  className="w-full rounded bg-blue-800 px-3 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-600"
                >
                  {dispatching
                    ? "Routing…"
                    : selectedNypd.size === 0
                    ? "Select units to dispatch"
                    : `Dispatch ${selectedNypd.size} unit${selectedNypd.size === 1 ? "" : "s"}`}
                </button>
              )}
            </div>
          </div>

          {/* ─── Right column: call info + responding ─── */}
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">

            {/* Call summary card */}
            <div className="shrink-0 border-b border-slate-800 bg-slate-900/60 px-5 py-4">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex-1">
                  <h2 className="text-base font-bold text-white">{call.name}</h2>
                  <div className="mt-0.5 flex items-center gap-3">
                    <p className="font-mono text-xs text-slate-500">
                      {call.latitude.toFixed(5)}, {call.longitude.toFixed(5)}
                    </p>
                    {assigned.length > 0 && (
                      <span className="text-xs font-semibold text-slate-300">
                        {assigned.length} unit{assigned.length === 1 ? "" : "s"}
                        {totalPersonnel > 0 && (
                          <span className="text-slate-400">
                            {" · "}{totalPersonnel} Personnel
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
                <ResolveCountdown
                  call={call}
                  hasUnitsOnScene={assigned.some((d) => d.phase === "onScene")}
                />
              </div>

              {assignment && call && (
                <AssignmentStaffing
                  assignment={assignment}
                  allAssignments={assignments}
                  units={assigned}
                  extra={call.extraRequirements}
                  required={call.requiredUnits}
                />
              )}
            </div>

            {/* Responding units */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {assigned.length === 0 ? (
                <p className="py-6 text-center text-sm italic text-slate-600">
                  No units responding yet
                </p>
              ) : (
                <div className="space-y-3">
                  {/* FDNY responders */}
                  {assigned.filter((d) => d.type !== "Patrol Car").length > 0 && (
                    <div>
                      <SectionLabel>
                        FDNY Responding ({assigned.filter((d) => d.type !== "Patrol Car").length})
                      </SectionLabel>
                      <ul className="mt-1.5 grid grid-cols-2 gap-1.5 xl:grid-cols-3">
                        {assigned.filter((d) => d.type !== "Patrol Car").map((d) => (
                          <AssignedRow
                            key={d.id}
                            record={d}
                            simSpeed={simSpeed}
                            busy={dispatching}
                            onReturn={() => void returnToQuarters(d.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* NYPD responders */}
                  {assigned.filter((d) => d.type === "Patrol Car").length > 0 && (
                    <div>
                      <SectionLabel>
                        NYPD Responding ({assigned.filter((d) => d.type === "Patrol Car").length})
                      </SectionLabel>
                      <ul className="mt-1.5 grid grid-cols-2 gap-1.5 xl:grid-cols-3">
                        {assigned.filter((d) => d.type === "Patrol Car").map((d) => (
                          <AssignedRow
                            key={d.id}
                            record={d}
                            simSpeed={simSpeed}
                            busy={dispatching}
                            onReturn={() => void returnToQuarters(d.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Selected count hint */}
            {currentSelectedCount > 0 && (
              <div className="shrink-0 border-t border-slate-800 bg-slate-900/40 px-5 py-2 text-xs text-slate-400">
                {currentSelectedCount} unit
                {currentSelectedCount === 1 ? "" : "s"} selected —{" "}
                click Dispatch in the panel on the left
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgencyTab({
  active,
  onClick,
  color,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: "red" | "blue";
  label: string;
}) {
  const ACTIVE: Record<string, string> = {
    red: "border-b-2 border-red-500 text-red-400 bg-slate-950",
    blue: "border-b-2 border-blue-500 text-blue-400 bg-slate-950",
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-xs font-bold tracking-widest transition-colors ${
        active ? ACTIVE[color] : "text-slate-600 hover:text-slate-300 bg-slate-900"
      }`}
    >
      {label}
    </button>
  );
}

function TypeChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
        active
          ? "border-red-600 bg-red-600/20 text-red-400"
          : "border-slate-700 text-slate-500 hover:border-slate-500 hover:text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

function FireUnitList({
  units,
  selected,
  onToggle,
  accent = "red",
}: {
  units: { id: string; callsign: string; type: string; locationLabel: string; dotColor: string; distanceMeters: number }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  accent?: "red" | "blue";
}) {
  if (units.length === 0) {
    return (
      <p className="p-4 text-center text-xs italic text-slate-600">
        No available units
      </p>
    );
  }
  const selectedCls = accent === "blue" ? "border-blue-700 bg-blue-700/10" : "border-red-700 bg-red-700/10";
  const checkboxCls = accent === "blue" ? "h-3.5 w-3.5 accent-blue-500" : "h-3.5 w-3.5 accent-red-500";
  return (
    <ul className="space-y-1">
      {units.map((u) => {
        const isSelected = selected.has(u.id);
        return (
          <li key={u.id}>
            <label
              className={`flex cursor-pointer items-center gap-2.5 rounded border px-2.5 py-2 text-xs ${
                isSelected
                  ? selectedCls
                  : "border-slate-800 hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(u.id)}
                className={checkboxCls}
              />
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: u.dotColor }}
              />
              <span className="flex-1 min-w-0">
                <span className="font-mono font-semibold text-white">
                  {u.callsign}
                </span>
                <span className="text-slate-500"> {u.type}</span>
                <span className="block truncate text-slate-600">
                  {u.locationLabel}
                </span>
              </span>
              <span className="shrink-0 font-mono text-slate-400">
                {formatDistance(u.distanceMeters)}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}


function CallStatusChip({ status }: { status: string }) {
  const COLOR: Record<string, string> = {
    Waiting: "bg-amber-900/60 text-amber-300 border-amber-700",
    Active: "bg-red-900/60 text-red-300 border-red-700",
    Resolved: "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  };
  return (
    <span
      className={`rounded border px-2 py-0.5 text-xs font-bold tracking-wide ${
        COLOR[status] ?? "bg-slate-700 text-slate-300 border-slate-600"
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">
      {children}
    </h3>
  );
}

function AssignmentStaffing({
  assignment,
  allAssignments,
  units,
  extra,
  required,
}: {
  assignment: Assignment;
  allAssignments: Assignment[];
  units: DispatchRecord[];
  extra?: Partial<AssignmentRequirements>;
  required?: Partial<AssignmentRequirements>;
}) {
  const [showChain, setShowChain] = useState(false);
  const onScene = units.filter((u) => u.phase === "onScene");
  const counts = countOnSceneByCategory(onScene);
  const requirements = REQUIREMENT_KEYS.filter(
    (key) => effectiveNeed(assignment, key, extra, required) > 0
  );
  if (requirements.length === 0) return null;

  const allMet = requirements.every(
    (key) => (counts[key] ?? 0) >= effectiveNeed(assignment, key, extra, required)
  );

  // Build upgrade chain starting from the current assignment.
  const upgradeChain = useMemo(() => {
    const chain: Assignment[] = [assignment];
    const byId = new Map(allAssignments.map((a) => [a.id, a]));
    let cur = assignment;
    while (cur.upgradeTo) {
      const next = byId.get(cur.upgradeTo);
      if (!next || chain.some((c) => c.id === next.id)) break;
      chain.push(next);
      cur = next;
    }
    return chain;
  }, [assignment, allAssignments]);

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400">
          Assignment:
        </span>
        <span className="text-xs font-bold text-white">{assignment.name}</span>
        {allMet && (
          <span className="text-xs font-semibold text-emerald-400">✓ Met</span>
        )}
        {upgradeChain.length > 1 && (
          <button
            type="button"
            onClick={() => setShowChain((v) => !v)}
            className="ml-auto text-[11px] text-slate-500 hover:text-slate-300"
            aria-label="Toggle upgrade chain"
          >
            {showChain ? "▲ chain" : "▼ chain"}
          </button>
        )}
      </div>
      {showChain && upgradeChain.length > 1 && (
        <ol className="mb-2 space-y-0.5 rounded border border-slate-700 bg-slate-900/60 px-2.5 py-2 text-[11px]">
          {upgradeChain.map((a, i) => (
            <li key={a.id} className="flex items-center gap-1.5">
              <span className={i === 0 ? "font-bold text-amber-300" : "text-slate-300"}>
                {i === 0 ? "▶ " : "  ↳ "}{a.name}
              </span>
              {a.upgradeProbability > 0 && i < upgradeChain.length - 1 && (
                <span className="ml-auto text-slate-500">{Math.round(a.upgradeProbability * 100)}% chance</span>
              )}
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {requirements.map((key) => {
          const have = counts[key] ?? 0;
          const need = effectiveNeed(assignment, key, extra, required);
          const modBonus = need - assignment[key];
          const met = have >= need;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className="h-1 w-16 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    met ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                  style={{ width: `${Math.min(100, (have / need) * 100)}%` }}
                />
              </div>
              <span
                className={`text-xs font-mono ${met ? "text-emerald-400" : "text-slate-400"}`}
              >
                {have}/{need} {CATEGORY_LABELS[key]}
                {modBonus > 0 && (
                  <span className="ml-1 text-orange-400">+{modBonus}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResolveCountdown({
  call,
  hasUnitsOnScene,
}: {
  call: Incident;
  hasUnitsOnScene: boolean;
}) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const resolving = call.resolveStartedAt != null && call.status !== "Resolved";

  useEffect(() => {
    if (!resolving) return;
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [resolving]);

  if (call.status === "Resolved") return null;

  if (call.resolveStartedAt == null) {
    if (hasUnitsOnScene && call.assignmentMetAt == null && call.status === "Active") {
      return (
        <div className="shrink-0 rounded border border-amber-800 bg-amber-900/20 px-3 py-1.5 text-right">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-500">
            Paused
          </div>
          <div className="text-xs font-bold text-amber-400">
            Awaiting units
          </div>
        </div>
      );
    }
    return null;
  }

  const simSpeed = useDispatchStore.getState().simSpeed;
  const remaining = remainingResolveMs(call.resolveStartedAt, simSpeed, call.resolveTimeGameMs);
  return (
    <div className="shrink-0 rounded border border-sky-800 bg-sky-900/30 px-3 py-1.5 text-right">
      <div className="text-xs font-semibold uppercase tracking-wide text-sky-500">
        Resolving
      </div>
      <div className="font-mono text-sm font-bold text-sky-300">
        {formatGameDuration(remaining)}
      </div>
    </div>
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
  const subLabel = formatArrivalSub(record, simSpeed);

  return (
    <li className="flex flex-col gap-1 rounded border border-slate-800 bg-slate-900/50 px-2.5 py-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: colorForPhase(record.phase) }}
          title={label}
        />
        <span className="font-mono font-semibold text-white">{record.callsign}</span>
        <span className="truncate text-slate-500">{record.type}</span>
      </div>
      <div className="flex items-center justify-between gap-1 pl-3.5">
        <span className="truncate text-slate-500">
          {label}
          {subLabel && <span className="ml-1 text-slate-400">{subLabel}</span>}
        </span>
        <button
          onClick={onReturn}
          disabled={busy}
          className="shrink-0 rounded border border-slate-700 px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {onScene ? "Return" : "Cancel"}
        </button>
      </div>
    </li>
  );
}

function formatArrivalSub(record: DispatchRecord, simSpeed: number): string {
  if (record.phase === "dispatched") {
    const elapsed = (performance.now() - record.startedAt) * simSpeed;
    const turnoutRemaining = Math.max(0, record.turnoutMs - elapsed);
    if (turnoutRemaining > 0) {
      return `leaving in ${formatGameDuration(turnoutRemaining)}`;
    }
    return "";
  }
  const remaining = remainingArrivalMs(record, simSpeed);
  if (remaining == null || remaining <= 0) return "";
  return `~${formatGameDuration(remaining)}`;
}

function XIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="1" y1="1" x2="13" y2="13" />
      <line x1="13" y1="1" x2="1" y2="13" />
    </svg>
  );
}
