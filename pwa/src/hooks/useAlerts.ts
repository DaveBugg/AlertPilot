import { useState, useCallback, useEffect, useRef } from "react";
import type { Alert, Role } from "@/types/alert";

const MAX_ALERTS = 200;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STORAGE_KEY = "alertpilot_alerts";

type ServerState = "acked" | "silenced" | "deleted";

// ── localStorage helpers ──────────────────────────────────────────────────

function loadAlerts(): Alert[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data: Alert[] = JSON.parse(raw);
    const cutoff = (Date.now() - MAX_AGE_MS) / 1000;
    return data.filter((a) => a.time > cutoff).slice(0, MAX_ALERTS);
  } catch {
    return [];
  }
}

function saveAlerts(alerts: Alert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts.slice(0, 50)));
    } catch { /* give up */ }
  }
}

// ── Server sync helpers ───────────────────────────────────────────────────

async function fetchServerStates(
  runnerUrl: string,
  token: string
): Promise<Map<string, ServerState>> {
  try {
    const resp = await fetch(`${runnerUrl}/api/alerts/states`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) return new Map();
    const data = await resp.json();
    const map = new Map<string, ServerState>();
    for (const [id, info] of Object.entries(data.states ?? {})) {
      map.set(id, (info as { state: ServerState }).state);
    }
    return map;
  } catch {
    return new Map();
  }
}

async function postState(
  runnerUrl: string,
  token: string,
  alertId: string,
  action: "ack" | "silence"
): Promise<void> {
  try {
    await fetch(`${runnerUrl}/api/alerts/${encodeURIComponent(alertId)}/${action}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* fire-and-forget */ }
}

async function serverDelete(
  runnerUrl: string,
  token: string,
  alertId: string
): Promise<void> {
  try {
    await fetch(`${runnerUrl}/api/alerts/${encodeURIComponent(alertId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch { /* fire-and-forget */ }
}

async function serverBulkDelete(
  runnerUrl: string,
  token: string,
  ids: string[]
): Promise<void> {
  try {
    await fetch(`${runnerUrl}/api/alerts/bulk-delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ids }),
    });
  } catch { /* fire-and-forget */ }
}

// ── Apply server states to an alert list ─────────────────────────────────

function applyServerStates(
  alerts: Alert[],
  states: Map<string, ServerState>
): Alert[] {
  return alerts
    .filter((a) => states.get(a.id) !== "deleted")
    .map((a) => {
      const s = states.get(a.id);
      if (!s) return a;
      return {
        ...a,
        acked: s === "acked" ? true : a.acked,
        silenced: s === "silenced" ? true : a.silenced,
      };
    });
}

// ── Hook ──────────────────────────────────────────────────────────────────

interface UseAlertsOptions {
  runnerUrl?: string;
  token?: string;
}

export function useAlerts(opts: UseAlertsOptions = {}) {
  const { runnerUrl = "", token = "" } = opts;

  const [alerts, setAlerts] = useState<Alert[]>(() => loadAlerts());

  // In-memory cache of server states — avoids re-fetching on every addAlert
  const serverStatesRef = useRef<Map<string, ServerState>>(new Map());

  // Persist to localStorage on every change
  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  // Sync server states on mount / when credentials change
  useEffect(() => {
    if (!runnerUrl || !token) return;

    fetchServerStates(runnerUrl, token).then((states) => {
      serverStatesRef.current = states;
      // Apply to already-loaded alerts
      setAlerts((prev) => applyServerStates(prev, states));
    });
  }, [runnerUrl, token]);

  // ── Mutations ─────────────────────────────────────────────────────────

  const addAlert = useCallback((alert: Alert) => {
    setAlerts((prev) => {
      if (prev.some((a) => a.id === alert.id)) return prev;

      // Apply any known server state to the incoming alert
      const s = serverStatesRef.current.get(alert.id);
      if (s === "deleted") return prev; // already deleted by this user
      const enriched: Alert = {
        ...alert,
        acked: s === "acked" || alert.acked,
        silenced: s === "silenced" || alert.silenced,
      };

      return [enriched, ...prev].slice(0, MAX_ALERTS);
    });
  }, []);

  const ackAlert = useCallback(
    (id: string) => {
      serverStatesRef.current.set(id, "acked");
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, acked: true } : a))
      );
      if (runnerUrl && token) postState(runnerUrl, token, id, "ack");
    },
    [runnerUrl, token]
  );

  const silenceAlert = useCallback(
    (id: string) => {
      serverStatesRef.current.set(id, "silenced");
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, silenced: true } : a))
      );
      if (runnerUrl && token) postState(runnerUrl, token, id, "silence");
    },
    [runnerUrl, token]
  );

  /** Delete one alert from this user's feed (local + server). */
  const deleteAlert = useCallback(
    (id: string) => {
      serverStatesRef.current.set(id, "deleted");
      setAlerts((prev) => prev.filter((a) => a.id !== id));
      if (runnerUrl && token) serverDelete(runnerUrl, token, id);
    },
    [runnerUrl, token]
  );

  /** Bulk-delete by ids (local + server). */
  const deleteAlerts = useCallback(
    (ids: string[]) => {
      const idSet = new Set(ids);
      ids.forEach((id) => serverStatesRef.current.set(id, "deleted"));
      setAlerts((prev) => prev.filter((a) => !idSet.has(a.id)));
      if (runnerUrl && token) serverBulkDelete(runnerUrl, token, ids);
    },
    [runnerUrl, token]
  );

  const filterByRole = useCallback(
    (role: Role | "all") => {
      if (role === "all") return alerts;
      return alerts.filter((a) => a.role === role);
    },
    [alerts]
  );

  const clearAll = useCallback(() => setAlerts([]), []);

  return {
    alerts,
    addAlert,
    ackAlert,
    silenceAlert,
    deleteAlert,
    deleteAlerts,
    filterByRole,
    clearAll,
  };
}
