import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import { Modal } from "@/shared/ui/Modal";

interface QuickActionsProps {
  onExecute: (name: string, params: Record<string, unknown>) => Promise<void>;
}

export function QuickActions({ onExecute }: QuickActionsProps) {
  const [scaleModal, setScaleModal] = useState(false);
  const [scaleService, setScaleService] = useState("api");
  const [replicas, setReplicas] = useState(2);
  const [executing, setExecuting] = useState<string | null>(null);

  const quickAction = async (name: string, params: Record<string, unknown>) => {
    setExecuting(name);
    try {
      await onExecute(name, params);
    } finally {
      setExecuting(null);
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={executing === "restart-nginx"}
          onClick={() => quickAction("restart", { service: "nginx" })}
        >
          Restart nginx
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={executing === "restart-api"}
          onClick={() => quickAction("restart", { service: "api" })}
        >
          Restart api
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setScaleModal(true)}
        >
          Scale...
        </Button>
      </div>

      <Modal
        open={scaleModal}
        onClose={() => setScaleModal(false)}
        title="Scale service"
        onConfirm={() => {
          setScaleModal(false);
          quickAction("scale", { service: scaleService, replicas });
        }}
        confirmLabel="Scale"
      >
        <div className="flex flex-col gap-3">
          <select
            value={scaleService}
            onChange={(e) => setScaleService(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm"
          >
            {["api", "worker", "nginx"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplicas((r) => Math.max(1, r - 1))}
            >
              -
            </Button>
            <span className="text-lg font-mono w-8 text-center">{replicas}</span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplicas((r) => Math.min(20, r + 1))}
            >
              +
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
