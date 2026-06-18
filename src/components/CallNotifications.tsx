import { useEffect } from "react";
import { useIncidentStore } from "../stores/incidentStore";
import { useDispatchStore } from "../stores/dispatchStore";

const AUTO_DISMISS_MS = 10_000;

export default function CallNotifications() {
  const notifications = useIncidentStore((s) => s.notifications);
  const dismissNotification = useIncidentStore((s) => s.dismissNotification);
  const focusCall = useDispatchStore((s) => s.focusCall);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-30 flex w-full max-w-sm flex-col gap-2 pointer-events-none">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          notification={notification}
          onDismiss={() => dismissNotification(notification.id)}
          onOpen={() => {
            focusCall(notification.callId);
            dismissNotification(notification.id);
          }}
        />
      ))}
    </div>
  );
}

function NotificationToast({
  notification,
  onDismiss,
  onOpen,
}: {
  notification: { id: string; title: string; status: string; kind: "new" | "upgrade" | "modifier" };
  onDismiss: () => void;
  onOpen: () => void;
}) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notification.id]);

  const kindLabel =
    notification.kind === "upgrade"
      ? "Call upgraded"
      : notification.kind === "modifier"
      ? "Modifier added"
      : "New call";

  const kindColor =
    notification.kind === "upgrade"
      ? "text-amber-400"
      : notification.kind === "modifier"
      ? "text-orange-400"
      : "text-sky-400";

  const borderColor =
    notification.kind === "modifier"
      ? "border-orange-500/40 hover:border-orange-400"
      : "border-sky-500/40 hover:border-sky-400";

  return (
    <div className={`pointer-events-auto rounded-xl border ${borderColor} bg-slate-950/95 shadow-2xl shadow-sky-950/40`}>
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex-1 text-left transition hover:opacity-80"
        >
          <div className={`text-xs font-semibold uppercase tracking-wide ${kindColor}`}>
            {kindLabel}
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
          onClick={onDismiss}
          className="mt-0.5 shrink-0 rounded-full p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
