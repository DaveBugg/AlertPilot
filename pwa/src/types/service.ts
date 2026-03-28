export type ServiceStatus = "ok" | "warn" | "down" | "unknown";

export interface ServiceInfo {
  name: string;
  status: ServiceStatus;
  lastCheck: number; // unix timestamp
}

export const STATUS_COLORS: Record<ServiceStatus, string> = {
  ok: "bg-emerald-500",
  warn: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-slate-600",
};

export const STATUS_LABELS: Record<ServiceStatus, string> = {
  ok: "OK",
  warn: "Warn",
  down: "Down",
  unknown: "?",
};
