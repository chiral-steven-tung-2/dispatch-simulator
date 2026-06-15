import { useState } from "react";
import MapView from "../components/MapView";
import StationsPanel from "../components/StationsPanel";
import CallsPanel from "../components/CallsPanel";
import DispatchPanel from "../components/DispatchPanel";
import CallNotifications from "../components/CallNotifications";
import UnitSearch from "../components/UnitSearch";
import { useDispatchData } from "../hooks/useDispatchData";
import { useCallSpawner } from "../hooks/useCallSpawner";
import { useResolveTicker } from "../hooks/useResolveTicker";
import { useAutoDispatcher } from "../hooks/useAutoDispatcher";
import { useDispatchStore } from "../stores/dispatchStore";
import { useIncidentStore } from "../stores/incidentStore";
import { useSettingsStore } from "../stores/settingsStore";
import { GAME_CONFIG } from "../config/gameConfig";

export default function HomePage() {
  const { loading, error } = useDispatchData();
  const [stationsOpen, setStationsOpen] = useState(false);
  const [callsOpen, setCallsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const showFdnyStations = useSettingsStore((s) => s.showFdnyStations);
  const showNypdStations = useSettingsStore((s) => s.showNypdStations);
  const showChiefQuarters = useSettingsStore((s) => s.showChiefQuarters);
  const showUnitIcons = useSettingsStore((s) => s.showUnitIcons);
  const showNotifications = useSettingsStore((s) => s.showNotifications);
  const toggleFdnyStations = useSettingsStore((s) => s.toggleFdnyStations);
  const toggleNypdStations = useSettingsStore((s) => s.toggleNypdStations);
  const toggleChiefQuarters = useSettingsStore((s) => s.toggleChiefQuarters);
  const toggleUnitIcons = useSettingsStore((s) => s.toggleUnitIcons);
  const toggleNotifications = useSettingsStore((s) => s.toggleNotifications);
  const showPaths = useDispatchStore((s) => s.showPaths);
  const togglePaths = useDispatchStore((s) => s.togglePaths);
  const autoDispatch = useDispatchStore((s) => s.autoDispatch);
  const toggleAutoDispatch = useDispatchStore((s) => s.toggleAutoDispatch);
  const simSpeed = useDispatchStore((s) => s.simSpeed);
  const setSimSpeed = useDispatchStore((s) => s.setSimSpeed);
  const spawnCall = useIncidentStore((s) => s.spawnCall);
  const autoSpawn = useIncidentStore((s) => s.autoSpawn);
  const toggleAutoSpawn = useIncidentStore((s) => s.toggleAutoSpawn);
  const activeCallCount = useIncidentStore(
    (s) => s.incidents.filter((i) => i.status !== "Resolved").length
  );

  useCallSpawner();
  useResolveTicker();
  useAutoDispatcher();

  return (
    <div className="flex h-full w-full flex-col bg-slate-900 text-slate-100">
      {showNotifications && <CallNotifications />}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 bg-slate-900/95 px-6 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            NYC Dispatch Simulator
          </h1>
          <Divider />
          <button
            onClick={() => setStationsOpen(true)}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-700"
          >
            Stations
          </button>
          <button
            onClick={() => setCallsOpen(true)}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-700"
          >
            Calls{" "}
            <span className="text-slate-400">({activeCallCount})</span>
          </button>
          <button
            onClick={spawnCall}
            disabled={loading}
            className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400"
          >
            + Spawn call
          </button>
        </div>
        <div className="flex items-center gap-3">
          <UnitSearch />
          <Divider />
          <SimSpeedControl value={simSpeed} onChange={setSimSpeed} />
          <Divider />
          <StatusBadge loading={loading} error={error} />
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center gap-1.5 rounded-md border border-slate-600 px-3 py-1.5 text-sm font-medium hover:bg-slate-700"
          >
            <GearGlyph /> Settings
          </button>
        </div>
      </header>

      <main className="flex-1">
        <MapView
          showFdnyStations={showFdnyStations}
          showNypdStations={showNypdStations}
          showChiefQuarters={showChiefQuarters}
          showUnitIcons={showUnitIcons}
        />
      </main>

      <StationsPanel
        open={stationsOpen}
        onClose={() => setStationsOpen(false)}
      />
      <CallsPanel open={callsOpen} onClose={() => setCallsOpen(false)} />
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        autoSpawn={autoSpawn}
        onToggleAutoSpawn={toggleAutoSpawn}
        autoDispatch={autoDispatch}
        onToggleAutoDispatch={toggleAutoDispatch}
        showNotifications={showNotifications}
        onToggleNotifications={toggleNotifications}
        showPaths={showPaths}
        onTogglePaths={togglePaths}
        showFdnyStations={showFdnyStations}
        onToggleFdnyStations={toggleFdnyStations}
        showNypdStations={showNypdStations}
        onToggleNypdStations={toggleNypdStations}
        showChiefQuarters={showChiefQuarters}
        onToggleChiefQuarters={toggleChiefQuarters}
        showUnitIcons={showUnitIcons}
        onToggleUnitIcons={toggleUnitIcons}
      />
      <DispatchPanel />
    </div>
  );
}

/** A small vertical divider between header control groups. */
function Divider() {
  return <div className="h-6 w-px bg-slate-700" aria-hidden="true" />;
}

type ToggleColor = "red" | "amber" | "blue" | "green";

// Written out in full so Tailwind's class scanner picks up each variant.
const TOGGLE_ACTIVE_TRACK: Record<ToggleColor, string> = {
  red: "peer-checked:bg-red-500",
  amber: "peer-checked:bg-amber-500",
  blue: "peer-checked:bg-blue-500",
  green: "peer-checked:bg-emerald-500",
};

/** A compact pill-style toggle switch, used in place of plain checkboxes. */
function ToggleSwitch({
  checked,
  onChange,
  label,
  activeColor,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  activeColor: ToggleColor;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-200">
      <span className="relative inline-flex h-5 w-9 shrink-0 items-center">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
        />
        <span
          className={`absolute inset-0 rounded-full bg-slate-600 transition-colors ${TOGGLE_ACTIVE_TRACK[activeColor]}`}
        />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}

/** A titled group of settings rows in the Settings panel. */
function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

/** A labeled setting row with an optional hint and a trailing control. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm">
      <span className="flex-1">
        <span className="font-medium">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
      {children}
    </div>
  );
}

function GearGlyph() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const SIM_SPEEDS = GAME_CONFIG.simSpeeds;

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

function SettingsPanel({
  open,
  onClose,
  autoSpawn,
  onToggleAutoSpawn,
  autoDispatch,
  onToggleAutoDispatch,
  showNotifications,
  onToggleNotifications,
  showPaths,
  onTogglePaths,
  showFdnyStations,
  onToggleFdnyStations,
  showNypdStations,
  onToggleNypdStations,
  showChiefQuarters,
  onToggleChiefQuarters,
  showUnitIcons,
  onToggleUnitIcons,
}: {
  open: boolean;
  onClose: () => void;
  autoSpawn: boolean;
  onToggleAutoSpawn: () => void;
  autoDispatch: boolean;
  onToggleAutoDispatch: () => void;
  showNotifications: boolean;
  onToggleNotifications: () => void;
  showPaths: boolean;
  onTogglePaths: () => void;
  showFdnyStations: boolean;
  onToggleFdnyStations: () => void;
  showNypdStations: boolean;
  onToggleNypdStations: () => void;
  showChiefQuarters: boolean;
  onToggleChiefQuarters: () => void;
  showUnitIcons: boolean;
  onToggleUnitIcons: () => void;
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
          <h2 className="text-lg font-bold">Settings</h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close settings panel"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-6">
            <SettingsSection title="Simulation">
              <SettingRow label="Auto calls" hint="Spawn new calls automatically">
                <ToggleSwitch
                  checked={autoSpawn}
                  onChange={onToggleAutoSpawn}
                  label=""
                  activeColor="red"
                />
              </SettingRow>
              <SettingRow
                label="Auto-dispatch"
                hint="Send nearest units to staff calls"
              >
                <ToggleSwitch
                  checked={autoDispatch}
                  onChange={onToggleAutoDispatch}
                  label=""
                  activeColor="green"
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection title="Display">
              <SettingRow
                label="Call notifications"
                hint="Show pop-up toasts for new calls"
              >
                <ToggleSwitch
                  checked={showNotifications}
                  onChange={onToggleNotifications}
                  label=""
                  activeColor="blue"
                />
              </SettingRow>
              <SettingRow label="Unit paths" hint="Draw routes for moving units">
                <ToggleSwitch
                  checked={showPaths}
                  onChange={onTogglePaths}
                  label=""
                  activeColor="amber"
                />
              </SettingRow>
            </SettingsSection>

            <LegendSection title="Map layers">
              <LegendRow icon={<FireHouseGlyph />} label="FDNY fire house">
                <ToggleSwitch
                  checked={showFdnyStations}
                  onChange={onToggleFdnyStations}
                  label="Show"
                  activeColor="red"
                />
              </LegendRow>
              <LegendRow
                icon={
                  <span className="flex items-center gap-1">
                    <ChiefBadge letter="B" color="#eab308" />
                    <ChiefBadge letter="D" color="#d97706" />
                  </span>
                }
                label="Battalion / Division chief quarters"
              >
                <ToggleSwitch
                  checked={showChiefQuarters}
                  onChange={onToggleChiefQuarters}
                  label="Show"
                  activeColor="amber"
                />
              </LegendRow>
              <LegendRow icon={<PoliceBadge />} label="NYPD precinct">
                <ToggleSwitch
                  checked={showNypdStations}
                  onChange={onToggleNypdStations}
                  label="Show"
                  activeColor="blue"
                />
              </LegendRow>
              <LegendRow
                icon={
                  <span className="flex items-center gap-1">
                    <ApparatusChip tag="E" color="#dc2626" />
                    <ApparatusChip tag="TL" color="#1d4ed8" />
                  </span>
                }
                label="Unit icons under each station"
              >
                <ToggleSwitch
                  checked={showUnitIcons}
                  onChange={onToggleUnitIcons}
                  label="Show"
                  activeColor="red"
                />
              </LegendRow>
            </LegendSection>

            <LegendSection title="Calls">
              <LegendRow icon={<Dot color="#dc2626" />} label="Waiting call" />
              <LegendRow icon={<Dot color="#f59e0b" />} label="Active call" />
              <LegendRow
                icon={<span className="text-lg leading-none">🔥</span>}
                label="Active fire call"
              />
            </LegendSection>

            <LegendSection title="Units">
              <LegendRow icon={<Dot color="#f59e0b" />} label="En route unit" />
              <LegendRow icon={<Dot color="#dc2626" />} label="On-scene unit" />
            </LegendSection>
          </div>
        </div>
      </aside>
    </div>
  );
}

function LegendSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function LegendRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5 text-sm">
      <span className="flex h-6 min-w-6 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="flex-1">{label}</span>
      {children}
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

function ApparatusChip({ tag, color }: { tag: string; color: string }) {
  return (
    <span
      className="rounded px-1 py-0.5 text-[9px] font-bold leading-none text-white"
      style={{ backgroundColor: color }}
    >
      {tag}
    </span>
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
