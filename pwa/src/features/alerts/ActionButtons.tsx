import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";
import type { ActionSchema } from "@/types/action";

interface ActionButtonsProps {
  matchedActions: ActionSchema[];
  alertText?: string; // alert title+message for auto-filling service
  onExecute: (actionName: string, params: Record<string, unknown>) => Promise<void>;
}

/** Try to extract a service name from alert text (e.g. "nginx returned 502" → "nginx") */
function guessService(text: string, whitelist: string[]): string {
  const lower = text.toLowerCase();
  for (const svc of whitelist) {
    if (lower.includes(svc.toLowerCase())) return svc;
  }
  return "";
}

export function ActionButtons({ matchedActions, alertText = "", onExecute }: ActionButtonsProps) {
  const [confirming, setConfirming] = useState<ActionSchema | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState(false);

  const handleClick = (action: ActionSchema) => {
    // Pre-fill params: defaults first, then try to guess service from alert text
    const initial: Record<string, string> = {};
    for (const [key, schema] of Object.entries(action.params)) {
      if (schema.default !== undefined) {
        initial[key] = String(schema.default);
      } else if (key === "service" && alertText) {
        const whitelist = ["nginx", "api", "worker", "postgres", "redis"];
        initial[key] = guessService(alertText, whitelist);
      } else {
        initial[key] = "";
      }
    }
    setParamValues(initial);

    if (action.confirm) {
      setConfirming(action);
    } else {
      runAction(action, initial);
    }
  };

  const runAction = async (action: ActionSchema, overrideParams?: Record<string, string>) => {
    setExecuting(true);
    try {
      const raw = overrideParams ?? paramValues;
      const params: Record<string, unknown> = {};
      for (const [key, schema] of Object.entries(action.params)) {
        const val = raw[key] ?? "";
        if (schema.type === "integer") {
          params[key] = parseInt(val, 10) || schema.default || 1;
        } else {
          params[key] = val || schema.default;
        }
      }
      await onExecute(action.name, params);
    } finally {
      setExecuting(false);
      setConfirming(null);
    }
  };

  // Required params without a default — need user input
  const requiredInputs = confirming
    ? Object.entries(confirming.params).filter(
        ([, schema]) => schema.required && schema.default === undefined
      )
    : [];

  if (matchedActions.length === 0) return null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {matchedActions.map((action) => (
          <Button
            key={action.name}
            size="sm"
            variant="secondary"
            onClick={() => handleClick(action)}
            disabled={executing}
          >
            {action.label.replace(/\{.*?\}/g, "...")}
          </Button>
        ))}
      </div>

      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title={`Confirm: ${confirming?.label.replace(/\{.*?\}/g, "...") || ""}`}
        onConfirm={() => confirming && runAction(confirming)}
        confirmLabel="Execute"
        confirmVariant="danger"
      >
        <p className="text-slate-400 text-sm mb-3">
          {confirming?.description}
        </p>

        {requiredInputs.map(([key, schema]) => (
          <label key={key} className="flex flex-col gap-1 mb-2">
            <span className="text-xs text-slate-400 capitalize">{key}</span>
            {schema.enum ? (
              <select
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={paramValues[key] || ""}
                onChange={(e) => setParamValues((p) => ({ ...p, [key]: e.target.value }))}
              >
                <option value="">Select...</option>
                {schema.enum.map((v: string) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : (
              <input
                type={schema.type === "integer" ? "number" : "text"}
                className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                value={paramValues[key] || ""}
                placeholder={schema.whitelist ? "nginx, api, worker..." : key}
                onChange={(e) => setParamValues((p) => ({ ...p, [key]: e.target.value }))}
                min={schema.min}
                max={schema.max}
              />
            )}
          </label>
        ))}
      </Modal>
    </>
  );
}
