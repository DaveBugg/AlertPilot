import { cn } from "@/shared/lib/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
}

const base = "inline-flex items-center justify-center rounded font-medium transition-colors disabled:opacity-50";

const variants: Record<string, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-500",
  secondary: "bg-slate-700 text-slate-200 hover:bg-slate-600",
  danger: "bg-red-700 text-white hover:bg-red-600",
  ghost: "text-slate-400 hover:text-slate-200 hover:bg-slate-800",
};

const sizes: Record<string, string> = {
  sm: "text-xs px-2 py-1",
  md: "text-sm px-3 py-1.5",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}
