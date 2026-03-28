export type Priority = 1 | 2 | 3 | 4 | 5;
export type Role = "ops" | "dev";

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: "min",
  2: "low",
  3: "normal",
  4: "high",
  5: "urgent",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  1: "text-slate-500",
  2: "text-slate-400",
  3: "text-blue-400",
  4: "text-orange-400",
  5: "text-red-500",
};

export const PRIORITY_BG: Record<Priority, string> = {
  1: "bg-slate-800",
  2: "bg-slate-700",
  3: "bg-blue-950",
  4: "bg-orange-950",
  5: "bg-red-950",
};

export interface Alert {
  id: string;
  title: string;
  message: string;
  priority: Priority;
  tags: string[];
  role: Role;
  topic: string;
  time: number; // unix timestamp
  acked: boolean;
  silenced: boolean;
  actions?: AlertAction[];
}

export interface AlertAction {
  action: "view" | "http" | "broadcast";
  label: string;
  url?: string;
  method?: string;
  body?: string;
}
