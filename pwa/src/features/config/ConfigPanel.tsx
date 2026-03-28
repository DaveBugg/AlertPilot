import type { AppConfig } from "@/hooks/useConfig";
import type { useWebPush } from "@/hooks/useWebPush";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";

interface ConfigPanelProps {
  config: AppConfig;
  onChange: (patch: Partial<AppConfig>) => void;
  push: ReturnType<typeof useWebPush>;
  onResetConfig: () => void;
}

const PUSH_STATUS_TEXT: Record<string, { label: string; color: string }> = {
  unsupported: { label: "Not supported by browser", color: "text-slate-500" },
  prompt: { label: "Not enabled", color: "text-slate-400" },
  granted: { label: "Permission granted, not subscribed", color: "text-amber-400" },
  denied: { label: "Blocked by browser", color: "text-red-400" },
  subscribing: { label: "Subscribing...", color: "text-blue-400" },
  subscribed: { label: "Active", color: "text-emerald-400" },
  error: { label: "Error", color: "text-red-400" },
};

export function ConfigPanel({ config, onChange, push, onResetConfig }: ConfigPanelProps) {
  const pushInfo = PUSH_STATUS_TEXT[push.state] || PUSH_STATUS_TEXT.prompt;

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold">Settings</h3>

      {/* ntfy Auth Token — per-user, can't be baked in */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-400">ntfy Auth Token</span>
        <input
          type="password"
          value={config.ntfyToken}
          onChange={(e) => onChange({ ntfyToken: e.target.value })}
          placeholder="tk_... (required in production)"
          className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <span className="text-xs text-slate-600">
          Generate: <code className="text-slate-500">ntfy token add &lt;username&gt;</code>
        </span>
      </label>

      <hr className="border-slate-700" />

      {/* Push notifications */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Push Notifications</span>
          <span className={cn("text-xs font-medium", pushInfo.color)}>
            {pushInfo.label}
          </span>
        </div>

        {push.error && (
          <p className="text-xs text-red-400">{push.error}</p>
        )}

        {(push.state === "prompt" || push.state === "granted" || push.state === "error") && (
          <Button
            size="sm"
            variant="secondary"
            onClick={push.subscribe}
            disabled={push.state === "subscribing" as any}
          >
            {push.state === "error" ? "Retry" : "Enable push notifications"}
          </Button>
        )}

        {push.state === "denied" && (
          <p className="text-xs text-slate-500">
            Notifications are blocked. Open browser settings to allow notifications for this site.
          </p>
        )}

        {push.state === "subscribed" && (
          <p className="text-xs text-slate-500">
            You'll receive alerts even when the app is closed.
          </p>
        )}
      </div>

      <hr className="border-slate-700" />

      {/* Server info — read-only, set via env vars at build time */}
      <div className="flex flex-col gap-1">
        <span className="text-xs text-slate-500 font-medium">Server</span>
        <div className="bg-slate-800/50 rounded px-3 py-2 flex flex-col gap-0.5">
          <span className="text-xs text-slate-500 truncate">{config.runnerUrl || "—"}</span>
          <span className="text-xs text-slate-600 truncate">{config.ntfyUrl || "—"}</span>
        </div>
        <button
          className="text-xs text-slate-600 hover:text-slate-400 text-left mt-0.5 transition-colors"
          onClick={onResetConfig}
        >
          Reset server config…
        </button>
      </div>
    </div>
  );
}
