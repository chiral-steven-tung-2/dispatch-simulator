import { useIncidentStore, type CallHistoryEntry } from "../stores/incidentStore";

interface Props {
  open: boolean;
  onClose: () => void;
}

function formatWallDuration(ms: number): string {
  const totalS = Math.round(ms / 1000);
  const h = Math.floor(totalS / 3600);
  const m = Math.floor((totalS % 3600) / 60);
  const s = totalS % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function CallHistoryPanel({ open, onClose }: Props) {
  const history = useIncidentStore((s) => s.callHistory);
  const assignments = useIncidentStore((s) => s.assignments);
  const assignmentById = new Map(assignments.map((a) => [a.id, a]));

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
            Call History{" "}
            <span className="text-sm font-normal text-slate-400">({history.length})</span>
          </h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close history panel"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {history.length === 0 ? (
            <p className="p-4 text-sm italic text-slate-500">No resolved calls yet.</p>
          ) : (
            <ul className="space-y-2">
              {history.map((entry) => (
                <HistoryRow
                  key={entry.id}
                  entry={entry}
                  assignmentName={assignmentById.get(entry.finalAssignmentId)?.name ?? entry.finalAssignmentId}
                />
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

function HistoryRow({
  entry,
  assignmentName,
}: {
  entry: CallHistoryEntry;
  assignmentName: string;
}) {
  const durationMs = entry.resolvedAt - entry.spawnedAt;

  return (
    <li className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-sm text-white">{entry.name}</span>
        <span className="shrink-0 text-xs text-emerald-400 font-semibold">✓ Resolved</span>
      </div>
      <p className="mt-0.5 text-xs text-amber-400">{assignmentName}</p>
      <div className="mt-1.5 flex gap-4 text-xs text-slate-400">
        <span>{entry.totalUnits} unit{entry.totalUnits === 1 ? "" : "s"}</span>
        <span>Duration: {formatWallDuration(durationMs)}</span>
      </div>
    </li>
  );
}
