import { cn } from "@/shared/lib/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "ops" | "dev" | "urgent" | "high" | "normal" | "low";
  className?: string;
}

const variants: Record<string, string> = {
  default: "bg-slate-700 text-slate-300",
  ops: "bg-amber-900/60 text-amber-300",
  dev: "bg-blue-900/60 text-blue-300",
  urgent: "bg-red-900/60 text-red-300",
  high: "bg-orange-900/60 text-orange-300",
  normal: "bg-blue-900/60 text-blue-300",
  low: "bg-slate-700 text-slate-400",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
