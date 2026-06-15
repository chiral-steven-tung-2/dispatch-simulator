import { useIncidentStore } from "../stores/incidentStore";
import { useDispatchStore } from "../stores/dispatchStore";

export default function CallNotifications() {
  const notifications = useIncidentStore((s) => s.notifications);
  const dismissNotification = useIncidentStore((s) => s.dismissNotification);
  const focusCall = useDispatchStore((s) => s.focusCall);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed right-4 top-20 z-30 flex w-full max-w-sm flex-col gap-2 pointer-events-none">
      {notifications.map((notification) => (
        <button
          key={notification.id}
          type="button"
          onClick={() => {
            focusCall(notification.callId);
            dismissNotification(notification.id);
          }}
          className="pointer-events-auto rounded-xl border border-sky-500/40 bg-slate-950/95 p-4 text-left shadow-2xl shadow-sky-950/40 transition hover:border-sky-400 hover:bg-slate-900"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className={`text-xs font-semibold uppercase tracking-wide ${
                  notification.kind === "upgrade" ? "text-amber-400" : "text-sky-400"
                }`}
              >
                {notification.kind === "upgrade" ? "Call upgraded" : "New call"}
              </div>
              <div className="mt-1 text-sm font-bold text-slate-50">
                {notification.title}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                {notification.status} · Click to jump to the call location
              </div>
            </div>
            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-sky-300">
              View
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}