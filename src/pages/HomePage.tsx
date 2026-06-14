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
  const [legendOpen, setLegendOpen] = useState(false);
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
          <button
            onClick={() => setLegendOpen(true)}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-700"
          >
            Legend
          </button>
        </div>
      </header>

      <main className="flex-1">
        <MapView />
      </main>

      <StationsPanel
        open={stationsOpen}
        onClose={() => setStationsOpen(false)}
      />
      <LegendPanel open={legendOpen} onClose={() => setLegendOpen(false)} />
      <DispatchPanel />
    </div>
  );
}

const SIM_SPEEDS = [1, 2, 3, 5, 10, 20, 30, 60];

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

function LegendPanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
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
          <h2 className="text-lg font-bold">Map legend</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close legend panel"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-4">
            <LegendRow icon={<FireHouseGlyph />} label="FDNY fire house" />
            <LegendRow
              icon={<ChiefBadge letter="B" color="#eab308" />}
              label="Battalion chief quarters"
            />
            <LegendRow
              icon={<ChiefBadge letter="D" color="#d97706" />}
              label="Division chief quarters"
            />
            <LegendRow
              icon={<PoliceBadge />}
              label="NYPD precinct"
            />
            <LegendRow
              icon={<Dot color="#dc2626" />}
              label="Active call"
            />
            <LegendRow
              icon={<Dot color="#f59e0b" />}
              label="En route unit"
            />
            <LegendRow
              icon={<Dot color="#dc2626" />}
              label="On-scene unit"
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

function LegendRow({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-sm">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function FireHouseGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 14 L16 4 L29 14 Z" fill="#991b1b" />
      <rect x="6" y="14" width="20" height="14" fill="#dc2626" />
      <rect x="12" y="18" width="8" height="10" fill="#fee2e2" />
    </svg>
  );
}

function ChiefBadge({ letter, color }: { letter: string; color: string }) {
  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-full border border-white text-[10px] font-extrabold text-white"
      style={{ backgroundColor: color }}
    >
      {letter}
    </span>
  );
}

function PoliceBadge() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 3 L25 6.5 V14.5 C25 20.2 21.4 25.1 16 28 C10.6 25.1 7 20.2 7 14.5 V6.5 Z"
        fill="#1e3a8a"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M16 8.5 L17.8 12.2 L21.9 12.8 L18.9 15.7 L19.6 19.8 L16 17.9 L12.4 19.8 L13.1 15.7 L10.1 12.8 L14.2 12.2 Z"
        fill="#ffffff"
        stroke="#ffffff"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3 w-3 shrink-0 rounded-full border border-white"
      style={{ backgroundColor: color }}
    />
  );
}
