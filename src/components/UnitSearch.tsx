import { useMemo, useState } from "react";
import { useUnitStore } from "../stores/unitStore";
import { useStationStore } from "../stores/stationStore";
import { useDispatchStore } from "../stores/dispatchStore";

const MAX_RESULTS = 8;

/** Navbar search: type a unit's callsign to jump the map to its quarters. */
export default function UnitSearch() {
  const units = useUnitStore((s) => s.units);
  const stations = useStationStore((s) => s.stations);
  const focusLocation = useDispatchStore((s) => s.focusLocation);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [];
    }
    return units
      .filter(
        (unit) =>
          unit.callsign.toLowerCase().includes(q) ||
          unit.type.toLowerCase().includes(q)
      )
      .slice(0, MAX_RESULTS);
  }, [units, query]);

  const select = (unitId: string) => {
    const unit = units.find((u) => u.id === unitId);
    if (!unit) {
      return;
    }
    const station = stations.find((s) => s.id === unit.stationId);
    if (!station) {
      return;
    }
    focusLocation([station.longitude, station.latitude]);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative w-56">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        placeholder="Find unit's quarters…"
        className="w-full rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm placeholder:text-slate-500 focus:border-amber-500 focus:outline-none"
      />
      {open && results.length > 0 && (
        <ul className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-800 shadow-lg">
          {results.map((unit) => {
            const station = stations.find((s) => s.id === unit.stationId);
            return (
              <li key={unit.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(unit.id);
                  }}
                  className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-700"
                >
                  <span>
                    <span className="font-medium">{unit.callsign}</span>
                    <span className="text-slate-400"> · {unit.type}</span>
                  </span>
                  {station && (
                    <span className="ml-2 truncate text-xs text-slate-500">
                      {station.name}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
