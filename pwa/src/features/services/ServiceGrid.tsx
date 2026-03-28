import { useState } from "react";
import { cn } from "@/shared/lib/cn";
import { STATUS_COLORS, STATUS_LABELS } from "@/types/service";
import type { ServiceInfo, ServiceStatus } from "@/types/service";

const INITIAL_SERVICES: ServiceInfo[] = [
  { name: "nginx", status: "ok", lastCheck: Date.now() / 1000 },
  { name: "api", status: "ok", lastCheck: Date.now() / 1000 },
  { name: "worker", status: "ok", lastCheck: Date.now() / 1000 },
  { name: "postgres", status: "ok", lastCheck: Date.now() / 1000 },
  { name: "redis", status: "ok", lastCheck: Date.now() / 1000 },
];

const STATUS_CYCLE: ServiceStatus[] = ["ok", "warn", "down", "unknown"];

export function ServiceGrid() {
  const [services, setServices] = useState<ServiceInfo[]>(INITIAL_SERVICES);

  const cycleStatus = (name: string) => {
    setServices((prev) =>
      prev.map((s) => {
        if (s.name !== name) return s;
        const idx = STATUS_CYCLE.indexOf(s.status);
        const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
        return { ...s, status: next, lastCheck: Date.now() / 1000 };
      })
    );
  };

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {services.map((s) => (
        <button
          key={s.name}
          onClick={() => cycleStatus(s.name)}
          className={cn(
            "flex flex-col items-center gap-1 p-3 rounded-lg border border-slate-700",
            "hover:border-slate-500 transition-colors bg-slate-900/50"
          )}
        >
          <div className={cn("w-3 h-3 rounded-full", STATUS_COLORS[s.status])} />
          <span className="text-xs font-medium truncate w-full text-center">
            {s.name}
          </span>
          <span className="text-[10px] text-slate-500">
            {STATUS_LABELS[s.status]}
          </span>
        </button>
      ))}
    </div>
  );
}
