import { useMemo, useState } from "react";
import { useStationStore } from "../stores/stationStore";
import { useUnitStore } from "../stores/unitStore";
import { useUnitsByStation, useUnitsByCurrentStation } from "../hooks/useUnitsByStation";
import { useRelocationStore } from "../stores/relocationStore";
import { statusColor } from "./unitDisplay";
import { garageSlots, relocationTargets, replacingUnitName } from "../utils/garage";
import { formatDistance } from "../utils/geo";
import type { Station, Unit } from "../models";

interface StationsPanelProps {
  open: boolean;
  onClose: () => void;
}

/** Trailing number from names like "Division 14" / "Battalion 52" for sorting. */
function rankOf(name: string): number {
  const match = name.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : Number.MAX_SAFE_INTEGER;
}

const byRank = (a: string, b: string) => rankOf(a) - rankOf(b) || a.localeCompare(b);

const ALL = "All";

/** True if a unit's callsign or type matches a (lowercased, trimmed) search query. */
function unitMatches(unit: Unit, query: string): boolean {
  return (
    unit.callsign.toLowerCase().includes(query) ||
    unit.type.toLowerCase().includes(query)
  );
}

export default function StationsPanel({ open, onClose }: StationsPanelProps) {
  const stations = useStationStore((s) => s.stations);
  const units = useUnitStore((s) => s.units);
  const unitsByStation = useUnitsByStation();
  const unitsByCurrentStation = useUnitsByCurrentStation();

  const [boroughFilter, setBoroughFilter] = useState(ALL);
  const [divisionFilter, setDivisionFilter] = useState(ALL);
  const [battalionFilter, setBattalionFilter] = useState(ALL);
  const [unitQuery, setUnitQuery] = useState("");

  const boroughs = useMemo(
    () => [...new Set(stations.map((s) => s.borough))].sort(),
    [stations]
  );
  const divisionOptions = useMemo(
    () => [...new Set(stations.map((s) => s.division))].sort(byRank),
    [stations]
  );
  const battalionOptions = useMemo(() => {
    const pool =
      divisionFilter === ALL
        ? stations
        : stations.filter((s) => s.division === divisionFilter);
    return [...new Set(pool.map((s) => s.battalion))].sort(byRank);
  }, [stations, divisionFilter]);

  // Stations with at least one unit (home or visiting) matching the search query.
  const matchingStationIds = useMemo(() => {
    const q = unitQuery.trim().toLowerCase();
    if (!q) {
      return null;
    }
    const ids = new Set<string>();
    for (const unit of units) {
      if (unitMatches(unit, q)) {
        ids.add(unit.stationId);
        ids.add(unit.currentStationId);
      }
    }
    return ids;
  }, [units, unitQuery]);

  const filteredStations = useMemo(() => {
    return stations.filter((station) => {
      if (boroughFilter !== ALL && station.borough !== boroughFilter) {
        return false;
      }
      if (divisionFilter !== ALL && station.division !== divisionFilter) {
        return false;
      }
      if (battalionFilter !== ALL && station.battalion !== battalionFilter) {
        return false;
      }
      if (matchingStationIds && !matchingStationIds.has(station.id)) {
        return false;
      }
      return true;
    });
  }, [stations, boroughFilter, divisionFilter, battalionFilter, matchingStationIds]);

  // Group filtered stations by Division, then Battalion.
  const divisions = useMemo(() => {
    const grouped = new Map<string, Map<string, Station[]>>();
    for (const station of filteredStations) {
      const battalions =
        grouped.get(station.division) ?? new Map<string, Station[]>();
      const list = battalions.get(station.battalion) ?? [];
      list.push(station);
      battalions.set(station.battalion, list);
      grouped.set(station.division, battalions);
    }
    return [...grouped.entries()]
      .sort((a, b) => byRank(a[0], b[0]))
      .map(([division, battalions]) => ({
        division,
        battalions: [...battalions.entries()]
          .sort((a, b) => byRank(a[0], b[0]))
          .map(([battalion, list]) => ({ battalion, stations: list })),
      }));
  }, [filteredStations]);

  const filtersActive =
    boroughFilter !== ALL ||
    divisionFilter !== ALL ||
    battalionFilter !== ALL ||
    unitQuery.trim() !== "";

  const resetFilters = () => {
    setBoroughFilter(ALL);
    setDivisionFilter(ALL);
    setBattalionFilter(ALL);
    setUnitQuery("");
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-20 flex justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-slate-800 text-slate-100 shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h2 className="text-lg font-bold">
            Stations{" "}
            <span className="text-sm font-normal text-slate-400">
              {filtersActive
                ? `(${filteredStations.length} of ${stations.length})`
                : `(${stations.length})`}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close stations panel"
          >
            ✕
          </button>
        </header>

        <div className="space-y-2 border-b border-slate-700 px-5 py-3">
          <div className="grid grid-cols-3 gap-2">
            <select
              value={boroughFilter}
              onChange={(e) => setBoroughFilter(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
            >
              <option value={ALL}>All boroughs</option>
              {boroughs.map((borough) => (
                <option key={borough} value={borough}>
                  {borough}
                </option>
              ))}
            </select>
            <select
              value={divisionFilter}
              onChange={(e) => {
                setDivisionFilter(e.target.value);
                setBattalionFilter(ALL);
              }}
              className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
            >
              <option value={ALL}>All divisions</option>
              {divisionOptions.map((division) => (
                <option key={division} value={division}>
                  {division}
                </option>
              ))}
            </select>
            <select
              value={battalionFilter}
              onChange={(e) => setBattalionFilter(e.target.value)}
              className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs focus:border-amber-500 focus:outline-none"
            >
              <option value={ALL}>All battalions</option>
              {battalionOptions.map((battalion) => (
                <option key={battalion} value={battalion}>
                  {battalion}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={unitQuery}
              onChange={(e) => setUnitQuery(e.target.value)}
              placeholder="Search units by callsign or type…"
              className="flex-1 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-xs placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
            />
            {filtersActive && (
              <button
                onClick={resetFilters}
                className="shrink-0 rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {divisions.length === 0 && (
            <p className="text-sm italic text-slate-500">
              No stations match the current filters.
            </p>
          )}
          {divisions.map(({ division, battalions }) => (
            <section key={division}>
              <div className="mb-2 flex items-baseline justify-between border-b-2 border-amber-600/60 pb-1">
                <h3 className="text-base font-bold text-amber-400">{division}</h3>
                <span className="text-xs text-slate-400">
                  {battalions.reduce((n, b) => n + b.stations.length, 0)} houses
                </span>
              </div>

              <div className="space-y-4">
                {battalions.map(({ battalion, stations: group }) => (
                  <div key={battalion}>
                    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {battalion}
                    </h4>
                    <div className="space-y-2">
                      {group.map((station) => (
                        <StationCard
                          key={station.id}
                          station={station}
                          allStations={stations}
                          allUnits={units}
                          homeUnits={unitsByStation[station.id] ?? []}
                          visitingUnits={(
                            unitsByCurrentStation[station.id] ?? []
                          ).filter((u) => u.stationId !== station.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

/** Color for a garage occupancy chip based on how full the bay is. */
function garageChipColor(occupied: number, capacity: number): string {
  if (occupied > capacity) {
    return "border-red-500/60 bg-red-500/10 text-red-300";
  }
  if (occupied < capacity) {
    return "border-amber-500/60 bg-amber-500/10 text-amber-300";
  }
  return "border-slate-600 bg-slate-800 text-slate-300";
}

function StationCard({
  station,
  allStations,
  allUnits,
  homeUnits,
  visitingUnits,
}: {
  station: Station;
  allStations: Station[];
  allUnits: Unit[];
  homeUnits: Unit[];
  visitingUnits: Unit[];
}) {
  const relocations = useRelocationStore((s) => s.relocations);
  const relocateUnit = useRelocationStore((s) => s.relocateUnit);
  const sendUnitHome = useRelocationStore((s) => s.sendUnitHome);
  const [relocatingUnitId, setRelocatingUnitId] = useState<string | null>(null);

  const slots = garageSlots(station.id, allUnits);
  const stationName = (id: string) =>
    allStations.find((s) => s.id === id)?.name ?? id;

  // Units mid-drive into this station's garage (not yet counted as occupants).
  const incoming = relocations.filter((r) => r.toStationId === station.id);

  const totalUnitCount = homeUnits.length + visitingUnits.length;

  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h5 className="font-semibold">{station.name}</h5>
        <span className="text-xs text-slate-400">{totalUnitCount} units</span>
      </div>
      <p className="mb-2 text-xs text-slate-400">{station.borough}</p>

      {slots.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <span
              key={slot.type}
              className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${garageChipColor(
                slot.occupied,
                slot.capacity
              )}`}
              title={`${slot.occupied}/${slot.capacity} ${slot.type} bays in use`}
            >
              {slot.occupied}/{slot.capacity} {slot.type}
            </span>
          ))}
        </div>
      )}

      {homeUnits.length === 0 ? (
        <p className="text-xs italic text-slate-500">No units assigned</p>
      ) : (
        <ul className="space-y-1.5">
          {homeUnits.map((unit) => {
            const atHome = unit.currentStationId === station.id;
            const relocation = relocations.find((r) => r.unitId === unit.id);
            const canRelocate = atHome && unit.status === "Available";
            const isPicking = relocatingUnitId === unit.id;

            return (
              <li key={unit.id} className="text-sm">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: statusColor(unit.status) }}
                    title={unit.status}
                  />
                  <span className="font-medium">{unit.callsign}</span>
                  <span className="text-slate-400">· {unit.type}</span>
                  <span className="ml-auto text-xs text-slate-400">
                    {describeUnitLocation(unit, station, relocation, allUnits, stationName)}
                  </span>
                  {canRelocate && (
                    <button
                      onClick={() =>
                        setRelocatingUnitId(isPicking ? null : unit.id)
                      }
                      className="rounded border border-slate-600 px-1.5 py-0.5 text-[11px] hover:bg-slate-700"
                    >
                      {isPicking ? "Cancel" : "Relocate"}
                    </button>
                  )}
                  {!atHome &&
                    unit.status === "Available" &&
                    !relocation && (
                      <button
                        onClick={() => void sendUnitHome(unit)}
                        className="rounded border border-slate-600 px-1.5 py-0.5 text-[11px] hover:bg-slate-700"
                      >
                        Recall
                      </button>
                    )}
                </div>

                {isPicking && (
                  <RelocationPicker
                    unit={unit}
                    station={station}
                    allStations={allStations}
                    allUnits={allUnits}
                    onPick={(toStationId) => {
                      void relocateUnit(unit, toStationId);
                      setRelocatingUnitId(null);
                    }}
                    onCancel={() => setRelocatingUnitId(null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {(incoming.length > 0 || visitingUnits.length > 0) && (
        <div className="mt-3 border-t border-slate-700 pt-2">
          <h6 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Covering here
          </h6>
          <ul className="space-y-1.5">
            {incoming.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: statusColor("Relocating") }}
                  title="Relocating"
                />
                <span className="font-medium">{r.callsign}</span>
                <span className="text-slate-400">· {r.type}</span>
                <span className="ml-auto text-xs text-slate-400">
                  Inbound from {stationName(r.fromStationId)}
                </span>
              </li>
            ))}
            {visitingUnits.map((unit) => (
              <li key={unit.id} className="flex items-center gap-2 text-sm">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: statusColor(unit.status) }}
                  title={unit.status}
                />
                <span className="font-medium">{unit.callsign}</span>
                <span className="text-slate-400">· {unit.type}</span>
                <span className="ml-auto text-xs text-slate-400">
                  ← from {stationName(unit.stationId)}
                </span>
                {unit.status === "Available" && (
                  <button
                    onClick={() => void sendUnitHome(unit)}
                    className="rounded border border-slate-600 px-1.5 py-0.5 text-[11px] hover:bg-slate-700"
                  >
                    Send home
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Short status note shown to the right of a home-roster unit's row. */
function describeUnitLocation(
  unit: Unit,
  station: Station,
  relocation: { toStationId: string; type: string; unitId: string } | undefined,
  allUnits: Unit[],
  stationName: (id: string) => string
): string {
  if (unit.status === "Relocating" && relocation) {
    if (relocation.toStationId === unit.stationId) {
      return "Returning home";
    }
    const replacing = replacingUnitName(
      relocation.toStationId,
      relocation.type,
      relocation.unitId,
      allUnits
    );
    return replacing
      ? `${unit.callsign} Act. ${replacing}`
      : `Relocating to ${stationName(relocation.toStationId)}`;
  }
  if (unit.currentStationId !== station.id) {
    const hostName = stationName(unit.currentStationId);
    if (unit.status === "Available") {
      return `Relocated to ${hostName}`;
    }
    return `${unit.status} (from ${hostName})`;
  }
  return unit.status;
}

/** Inline list of candidate destination stations with open bays for a unit's type. */
function RelocationPicker({
  unit,
  station,
  allStations,
  allUnits,
  onPick,
  onCancel,
}: {
  unit: Unit;
  station: Station;
  allStations: Station[];
  allUnits: Unit[];
  onPick: (stationId: string) => void;
  onCancel: () => void;
}) {
  const targets = useMemo(
    () =>
      relocationTargets(
        unit.type,
        station.id,
        allStations,
        allUnits,
        [station.longitude, station.latitude]
      ).slice(0, 8),
    [unit.type, station, allStations, allUnits]
  );

  return (
    <div className="mt-1.5 rounded-md border border-slate-700 bg-slate-800/60 p-2">
      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
        <span>Send {unit.callsign} to cover…</span>
        <button onClick={onCancel} className="hover:text-white">
          ✕
        </button>
      </div>
      {targets.length === 0 ? (
        <p className="text-xs italic text-slate-500">
          No stations with an open {unit.type} bay nearby.
        </p>
      ) : (
        <ul className="space-y-1">
          {targets.map(({ station: target, distanceMeters, openSlots }) => (
            <li key={target.id}>
              <button
                onClick={() => onPick(target.id)}
                className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-slate-700"
              >
                <span>
                  {target.name}{" "}
                  <span className="text-slate-500">
                    ({openSlots} open bay{openSlots === 1 ? "" : "s"})
                  </span>
                </span>
                <span className="text-slate-400">
                  {formatDistance(distanceMeters)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
