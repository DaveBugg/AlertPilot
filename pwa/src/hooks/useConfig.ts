import { useState, useCallback } from "react";

export interface AppConfig {
  ntfyUrl: string;
  opsTopic: string;
  devTopic: string;
  ntfyToken: string;
  runnerUrl: string;
  runnerSecret: string;
}

const STORAGE_KEY = "alertpilot_config";

// Baked in at build time via Vite env vars (VITE_NTFY_URL, VITE_RUNNER_URL etc.)
// Falls back to empty string if not set — user fills them in Setup screen.
const ENV_DEFAULTS: Partial<AppConfig> = {
  ntfyUrl: import.meta.env.VITE_NTFY_URL || "",
  runnerUrl: import.meta.env.VITE_RUNNER_URL || "",
  opsTopic: import.meta.env.VITE_OPS_TOPIC || "ops-alerts",
  devTopic: import.meta.env.VITE_DEV_TOPIC || "dev-alerts",
};

const DEFAULT_CONFIG: AppConfig = {
  ntfyUrl: ENV_DEFAULTS.ntfyUrl || "",
  opsTopic: ENV_DEFAULTS.opsTopic || "ops-alerts",
  devTopic: ENV_DEFAULTS.devTopic || "dev-alerts",
  ntfyToken: "",
  runnerUrl: ENV_DEFAULTS.runnerUrl || "",
  runnerSecret: "",
};

function loadConfig(): AppConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_CONFIG;
}

export function useConfig() {
  const [config, setConfigState] = useState<AppConfig>(loadConfig);

  const setConfig = useCallback((patch: Partial<AppConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isConfigured = Boolean(config.ntfyUrl && config.runnerUrl);

  return { config, setConfig, isConfigured };
}
