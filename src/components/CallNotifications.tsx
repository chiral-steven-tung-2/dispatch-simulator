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
        <div
          key={notification.id}
          className="pointer-events-auto rounded-xl border border-sky-500/40 bg-slate-950/95 shadow-2xl shadow-sky-950/40"
        >
          <div className="flex items-start gap-3 p-4">
            <button
              type="button"
              onClick={() => {
                focusCall(notification.callId);
                dismissNotification(notification.id);
              }}
              className="flex-1 text-left transition hover:opacity-80"
            >
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
                {notification.status} · Click to open call
              </div>
            </button>
            <button
              type="button"
              onClick={() => dismissNotification(notification.id)}
              className="mt-0.5 shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}