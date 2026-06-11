import { useMemo } from "react";
import { useStationStore } from "../stores/stationStore";
import { useUnitsByStation } from "../hooks/useUnitsByStation";
import { statusColor } from "./unitDisplay";
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

export default function StationsPanel({ open, onClose }: StationsPanelProps) {
  const stations = useStationStore((s) => s.stations);
  const unitsByStation = useUnitsByStation();

  // Group stations by Division, then Battalion.
  const divisions = useMemo(() => {
    const grouped = new Map<string, Map<string, Station[]>>();
    for (const station of stations) {
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
  }, [stations]);

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
              ({stations.length})
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

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
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
                          name={station.name}
                          borough={station.borough}
                          units={unitsByStation[station.id] ?? []}
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

function StationCard({
  name,
  borough,
  units,
}: {
  name: string;
  borough: string;
  units: Unit[];
}) {
  return (
    <section className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h5 className="font-semibold">{name}</h5>
        <span className="text-xs text-slate-400">{units.length} units</span>
      </div>
      <p className="mb-2 text-xs text-slate-400">{borough}</p>

      {units.length === 0 ? (
        <p className="text-xs italic text-slate-500">No units assigned</p>
      ) : (
        <ul className="space-y-1.5">
          {units.map((unit) => (
            <li key={unit.id} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: statusColor(unit.status) }}
                title={unit.status}
              />
              <span className="font-medium">{unit.callsign}</span>
              <span className="text-slate-400">· {unit.type}</span>
              <span className="ml-auto text-xs text-slate-400">
                {unit.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
