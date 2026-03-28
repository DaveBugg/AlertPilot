import { cn } from "@/shared/lib/cn";
import { Badge } from "@/shared/ui/Badge";
import { Button } from "@/shared/ui/Button";
import { ActionButtons } from "./ActionButtons";
import { PRIORITY_LABELS, PRIORITY_BG } from "@/types/alert";
import type { Alert } from "@/types/alert";
import type { ActionSchema } from "@/types/action";

interface AlertCardProps {
  alert: Alert;
  matchedActions: ActionSchema[];
  isSelected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  onAck: (id: string) => void;
  onSilence: (id: string) => void;
  onDelete: (id: string) => void;
  onExecuteAction: (name: string, params: Record<string, unknown>) => Promise<void>;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function AlertCard({
  alert,
  matchedActions,
  isSelected = false,
  onSelect,
  onAck,
  onSilence,
  onDelete,
  onExecuteAction,
}: AlertCardProps) {
  const priorityLabel = PRIORITY_LABELS[alert.priority] || "normal";
  const priorityVariant = priorityLabel as "urgent" | "high" | "normal" | "low";

  return (
    <div
      className={cn(
        "rounded-lg border p-3 transition-opacity relative",
        PRIORITY_BG[alert.priority],
        alert.priority === 5 ? "border-red-700" : "border-slate-700",
        isSelected && "ring-1 ring-blue-500",
        alert.acked && !isSelected && "opacity-50",
        alert.silenced && !isSelected && "opacity-30"
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1">
        {/* Checkbox for multi-select */}
        {onSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onSelect(alert.id, e.target.checked)}
            className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-800 accent-blue-500 shrink-0 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        )}

        <Badge variant={priorityVariant}>{priorityLabel}</Badge>
        <Badge variant={alert.role}>{alert.role}</Badge>
        {alert.tags.length > 0 && (
          <span className="text-xs text-slate-500">{alert.tags.join(", ")}</span>
        )}
        <span className="text-xs text-slate-500 ml-auto">{timeAgo(alert.time)}</span>
      </div>

      {/* Title */}
      {alert.title && (
        <h4 className="font-semibold text-sm mb-1">{alert.title}</h4>
      )}

      {/* Message */}
      {alert.message && (
        <p className="text-sm text-slate-300 whitespace-pre-wrap break-words">
          {alert.message}
        </p>
      )}

      {/* ntfy-provided action buttons (view links) */}
      {alert.actions && alert.actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {alert.actions.map((a, i) =>
            a.url ? (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                {a.label}
              </a>
            ) : null
          )}
        </div>
      )}

      {/* Trigger-matched runner actions */}
      <ActionButtons
        matchedActions={matchedActions}
        alertText={`${alert.title} ${alert.message}`}
        onExecute={onExecuteAction}
      />

      {/* Ack / Silence / Delete */}
      <div className="flex gap-1.5 mt-2 pt-2 border-t border-slate-700/50">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onAck(alert.id)}
          disabled={alert.acked}
        >
          {alert.acked ? "Acked" : "Ack"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onSilence(alert.id)}
          disabled={alert.silenced}
        >
          {alert.silenced ? "Silenced" : "Silence"}
        </Button>

        {/* Delete — right-aligned */}
        <button
          className="ml-auto text-xs text-slate-600 hover:text-red-400 transition-colors px-1"
          onClick={() => onDelete(alert.id)}
          title="Delete alert"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
