import { useState, useCallback } from "react";
import { AlertCard } from "./AlertCard";
import { Button } from "@/shared/ui/Button";
import type { Alert } from "@/types/alert";
import type { ActionSchema } from "@/types/action";

interface AlertFeedProps {
  alerts: Alert[];
  matchTriggers: (text: string) => ActionSchema[];
  onAck: (id: string) => void;
  onSilence: (id: string) => void;
  onDelete: (id: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onExecuteAction: (name: string, params: Record<string, unknown>) => Promise<void>;
}

export function AlertFeed({
  alerts,
  matchTriggers,
  onAck,
  onSilence,
  onDelete,
  onDeleteMany,
  onExecuteAction,
}: AlertFeedProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(alerts.map((a) => a.id)));
  }, [alerts]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
  }, []);

  const handleDeleteSelected = useCallback(() => {
    const ids = [...selected];
    onDeleteMany(ids);
    setSelected(new Set());
  }, [selected, onDeleteMany]);

  const handleDeleteOne = useCallback(
    (id: string) => {
      onDelete(id);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    },
    [onDelete]
  );

  if (alerts.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12">
        <p className="text-lg mb-1">No alerts yet</p>
        <p className="text-sm">Waiting for incoming notifications...</p>
      </div>
    );
  }

  const selectionCount = selected.size;
  const allSelected = selectionCount === alerts.length && alerts.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Selection toolbar ── */}
      {selectionCount > 0 ? (
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <span className="text-xs text-slate-300 font-medium">
            {selectionCount} selected
          </span>
          {!allSelected && (
            <button
              className="text-xs text-slate-400 hover:text-slate-200"
              onClick={selectAll}
            >
              Select all ({alerts.length})
            </button>
          )}
          <button
            className="text-xs text-slate-500 hover:text-slate-300"
            onClick={clearSelection}
          >
            Clear
          </button>
          <Button
            size="sm"
            variant="secondary"
            className="ml-auto text-red-400 border-red-800 hover:bg-red-950"
            onClick={handleDeleteSelected}
          >
            Delete {selectionCount}
          </Button>
        </div>
      ) : (
        /* Show "select all" hint only when there are multiple alerts */
        alerts.length > 1 && (
          <div className="flex justify-end">
            <button
              className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
              onClick={selectAll}
            >
              Select all
            </button>
          </div>
        )
      )}

      {/* ── Alert cards ── */}
      {alerts.map((alert) => (
        <AlertCard
          key={alert.id}
          alert={alert}
          matchedActions={matchTriggers(`${alert.title} ${alert.message}`)}
          isSelected={selected.has(alert.id)}
          onSelect={toggleSelect}
          onAck={onAck}
          onSilence={onSilence}
          onDelete={handleDeleteOne}
          onExecuteAction={onExecuteAction}
        />
      ))}
    </div>
  );
}
