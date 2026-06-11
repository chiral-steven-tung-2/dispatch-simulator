import { useState } from "react";
import MapView from "../components/MapView";
import StationsPanel from "../components/StationsPanel";
import DispatchPanel from "../components/DispatchPanel";
import { useDispatchData } from "../hooks/useDispatchData";
import { useCallSpawner } from "../hooks/useCallSpawner";
import { useResolveTicker } from "../hooks/useResolveTicker";
import { useDispatchStore } from "../stores/dispatchStore";
import { useIncidentStore } from "../stores/incidentStore";

export default function HomePage() {
  const { loading, error } = useDispatchData();
  const [stationsOpen, setStationsOpen] = useState(false);
  const showPaths = useDispatchStore((s) => s.showPaths);
  const togglePaths = useDispatchStore((s) => s.togglePaths);
  const simSpeed = useDispatchStore((s) => s.simSpeed);
  const setSimSpeed = useDispatchStore((s) => s.setSimSpeed);
  const spawnCall = useIncidentStore((s) => s.spawnCall);
  const autoSpawn = useIncidentStore((s) => s.autoSpawn);
  const toggleAutoSpawn = useIncidentStore((s) => s.toggleAutoSpawn);

  useCallSpawner();
  useResolveTicker();

  return (
    <div className="flex h-full w-full flex-col bg-slate-900 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            NYC Dispatch Simulator
          </h1>
          <button
            onClick={() => setStationsOpen(true)}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-700"
          >
            Stations
          </button>
          <button
            onClick={spawnCall}
            disabled={loading}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
          >
            + Spawn call
          </button>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoSpawn}
              onChange={toggleAutoSpawn}
              className="h-4 w-4 accent-red-500"
            />
            Auto calls
          </label>
        </div>
        <div className="flex items-center gap-4">
          <SimSpeedControl value={simSpeed} onChange={setSimSpeed} />
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPaths}
              onChange={togglePaths}
              className="h-4 w-4 accent-amber-500"
            />
            Show paths
          </label>
          <StatusBadge loading={loading} error={error} />
          <Legend />
        </div>
      </header>

      <main className="flex-1">
        <MapView />
      </main>

      <StationsPanel
        open={stationsOpen}
        onClose={() => setStationsOpen(false)}
      />
      <DispatchPanel />
    </div>
  );
}

const SIM_SPEEDS = [1, 10, 30, 60, 120, 300];

function SimSpeedControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-400">Speed</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm"
      >
        {SIM_SPEEDS.map((speed) => (
          <option key={speed} value={speed}>
            {speed === 1 ? "1× (real time)" : `${speed}×`}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  if (error) {
    return (
      <span className="text-sm text-red-400" title={error}>
        ● Backend unavailable
      </span>
    );
  }
  if (loading) {
    return <span className="text-sm text-amber-400">● Loading…</span>;
  }
  return <span className="text-sm text-emerald-400">● Connected</span>;
}

function Legend() {
  const dots = [
    { label: "Call", color: "#dc2626" },
    { label: "En route", color: "#f59e0b" },
  ];

  return (
    <ul className="flex items-center gap-4 text-sm">
      <li className="flex items-center gap-2">
        <HouseGlyph />
        Fire house
      </li>
      <li className="flex items-center gap-2">
        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-white bg-amber-500 text-[9px] font-extrabold text-white">
          B
        </span>
        Chief HQ
      </li>
      {dots.map((item) => (
        <li key={item.label} className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full border border-white"
            style={{ backgroundColor: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

function HouseGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 14 L16 4 L29 14 Z" fill="#991b1b" />
      <rect x="6" y="14" width="20" height="14" fill="#dc2626" />
      <rect x="12" y="18" width="8" height="10" fill="#fee2e2" />
    </svg>
  );
}
