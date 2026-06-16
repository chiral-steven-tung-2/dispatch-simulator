import { useEffect, useMemo, useReducer } from "react";
import { useIncidentStore } from "../stores/incidentStore";
import {
  useDispatchStore,
  type DispatchRecord,
  remainingArrivalMs,
} from "../stores/dispatchStore";
import { remainingResolveMs, formatGameDuration } from "../utils/resolve";
import { colorForPhase, phaseLabel } from "./movingUnitMarker";
import type { Incident, IncidentStatus } from "../models";

interface CallsPanelProps {
  open: boolean;
  onClose: () => void;
}

const STATUS_COLOR: Record<IncidentStatus, string> = {
  Waiting: "#dc2626",
  Active: "#f59e0b",
  Resolved: "#64748b",
};

// Waiting calls (no units yet) surface above Active ones.
const STATUS_RANK: Record<IncidentStatus, number> = {
  Waiting: 0,
  Active: 1,
  Resolved: 2,
};

/** Slide-in dashboard listing every live call and its responding units. */
export default function CallsPanel({ open, onClose }: CallsPanelProps) {
  const incidents = useIncidentStore((s) => s.incidents);
  const dispatches = useDispatchStore((s) => s.dispatches);
  const focusCall = useDispatchStore((s) => s.focusCall);
  const simSpeed = useDispatchStore((s) => s.simSpeed);

  // Re-render once a second while open so resolve countdowns stay live.
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (!open) {
      return;
    }
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  const calls = useMemo(
    () =>
      incidents
        .filter((i) => i.status !== "Resolved")
        .map((incident) => ({
          incident,
          units: dispatches.filter((d) => d.callId === incident.id),
        }))
        .sort(
          (a, b) =>
            STATUS_RANK[a.incident.status] - STATUS_RANK[b.incident.status]
        ),
    [incidents, dispatches]
  );

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
            Active Calls{" "}
            <span className="text-sm font-normal text-slate-400">
              ({calls.length})
            </span>
          </h2>
          <button
            onClick={onClose}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white"
            aria-label="Close calls panel"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {calls.length === 0 ? (
            <p className="p-4 text-sm italic text-slate-500">
              No active calls.
            </p>
          ) : (
            calls.map(({ incident, units }) => (
              <CallCard
                key={incident.id}
                incident={incident}
                units={units}
                simSpeed={simSpeed}
                onSelect={() => {
                  focusCall(incident.id);
                  onClose();
                }}
              />
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function CallCard({
  incident,
  units,
  simSpeed,
  onSelect,
}: {
  incident: Incident;
  units: DispatchRecord[];
  simSpeed: number;
  onSelect: () => void;
}) {
  const onSceneCount = units.filter((u) => u.phase === "onScene").length;
  const respondingCount = units.length - onSceneCount;
  const assignment = useIncidentStore((s) =>
    s.assignments.find((a) => a.id === incident.assignmentId)
  );
  const appliedModifiers = useIncidentStore((s) =>
    s.modifiers.filter((m) => incident.activeModifiers.includes(m.id))
  );

  return (
    <button
      onClick={onSelect}
      className="w-full rounded-lg border border-slate-700 bg-slate-900/50 p-3 text-left transition hover:border-amber-500/60 hover:bg-slate-900/80"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: STATUS_COLOR[incident.status] }}
          />
          {incident.name}
        </span>
        <span className="text-xs text-slate-400">{incident.status}</span>
      </div>

      {assignment && (
        <p className="mt-1 text-xs font-medium text-amber-400">
          {assignment.name}
          {incident.assignmentMetAt == null && incident.status === "Active" && (
            <span className="ml-1 text-slate-400">· awaiting full assignment</span>
          )}
        </p>
      )}

      <p className="mt-1 text-xs text-slate-400">
        {units.length === 0
          ? "No units assigned"
          : `${onSceneCount} on scene · ${respondingCount} responding`}
      </p>

      {appliedModifiers.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {appliedModifiers.map((m) => (
            <span
              key={m.id}
              className="inline-block rounded bg-orange-900/60 px-1.5 py-0.5 text-[11px] font-medium text-orange-300"
            >
              {m.name}
            </span>
          ))}
        </div>
      )}

      <ResolveCountdown incident={incident} />

      {units.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-slate-700 pt-2">
          {units.map((unit) => (
            <li key={unit.id} className="flex items-center gap-2 text-xs">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: colorForPhase(unit.phase) }}
              />
              <span className="font-medium">{unit.callsign}</span>
              <span className="text-slate-400">· {unit.type}</span>
              <span className="ml-auto text-right text-slate-500">
                <span className="block">{phaseLabel(unit.phase)}</span>
                {ArrivalCountdown(unit, simSpeed) && (
                  <span className="block text-[11px] text-slate-400">
                    {ArrivalCountdown(unit, simSpeed)}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </button>
  );
}

function ArrivalCountdown(record: DispatchRecord, simSpeed: number): string {
  const remaining = remainingArrivalMs(record, simSpeed);
  if (remaining == null) {
    return "";
  }
  return remaining <= 0 ? "On scene" : `Arrives in ${formatGameDuration(remaining)}`;
}

function ResolveCountdown({ incident }: { incident: Incident }) {
  if (incident.resolveStartedAt == null || incident.status === "Resolved") {
    return null;
  }
  const simSpeed = useDispatchStore.getState().simSpeed;
  const remaining = remainingResolveMs(incident.resolveStartedAt, simSpeed, incident.resolveTimeGameMs);
  return (
    <p className="mt-1 text-xs font-semibold text-sky-400">
      ⏱ Resolving in {formatGameDuration(remaining)}
    </p>
  );
}
