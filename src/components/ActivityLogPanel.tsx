import { useRelocationStore, type RelocationLogEntry } from "../stores/relocationStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatAge(at: number): string {
  const ageS = Math.round((performance.now() - at) / 1000);
  if (ageS < 60) return `${ageS}s ago`;
  const m = Math.floor(ageS / 60);
  return `${m}m ago`;
}

export default function ActivityLogPanel({ open, onClose }: Props) {
  const log = useRelocationStore((s) => s.relocationLog);

  if (!open) return null;

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
            Relocation Log{" "}
            <span className="text-sm font-normal text-slate-400">({log.length})</span>
          </h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close activity log"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {log.length === 0 ? (
            <p className="p-4 text-sm italic text-slate-500">
              No relocations yet — auto-relocate will populate this log.
            </p>
          ) : (
            <ul className="space-y-2">
              {log.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function LogRow({ entry }: { entry: RelocationLogEntry }) {
  return (
    <li className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-sm text-white">{entry.unitCallsign}</span>
        <span className="text-xs text-slate-500">{formatAge(entry.at)}</span>
      </div>
      <p className="mt-0.5 text-xs text-slate-400">{entry.unitType}</p>
      <p className="mt-1 text-xs text-slate-300">
        {entry.fromStationName}{" "}
        <span className="text-slate-500">→</span>{" "}
        {entry.toStationName}
      </p>
    </li>
  );
}
