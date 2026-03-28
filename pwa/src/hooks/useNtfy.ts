import { useEffect, useRef, useCallback, useState } from "react";
import type { Alert, Priority, Role } from "@/types/alert";

interface NtfyMessage {
  id: string;
  time: number;
  event: string;
  topic: string;
  title?: string;
  message?: string;
  priority?: number;
  tags?: string[];
  actions?: Array<{
    action: string;
    label: string;
    url?: string;
    method?: string;
    body?: string;
  }>;
}

interface UseNtfyOptions {
  serverUrl: string;
  topic: string;
  token?: string;
  role: Role;
  onAlert: (alert: Alert) => void;
}

// --- Persistence: track last received message time per topic ---
// This allows ?since= replay of missed messages on reconnect

function lastSeenKey(topic: string): string {
  return `ntfy_last_${topic}`;
}

// Default lookback for fresh browser (no prior lastSeen stored)
const DEFAULT_LOOKBACK_SECONDS = 12 * 60 * 60; // 12 hours

function getLastSeen(topic: string): number {
  const val = localStorage.getItem(lastSeenKey(topic));
  if (val) return parseInt(val, 10);
  // First connect — replay last 12h from ntfy cache so alerts aren't lost on fresh install
  return Math.floor(Date.now() / 1000) - DEFAULT_LOOKBACK_SECONDS;
}

function setLastSeen(topic: string, time: number): void {
  try {
    localStorage.setItem(lastSeenKey(topic), String(time));
  } catch {
    // ignore quota errors
  }
}

// --- URL builder ---

function buildWsUrl(serverUrl: string, topic: string, since: number, token?: string): string {
  const base = serverUrl.replace(/\/$/, "");
  const wsBase = base.replace(/^http/, "ws");

  const params: string[] = [];
  // Replay messages missed while offline (ntfy caches up to cache-duration, default 12h)
  if (since > 0) {
    params.push(`since=${since}`);
  }
  if (token) {
    params.push(`auth=${encodeURIComponent(`Bearer ${token}`)}`);
  }

  return `${wsBase}/${topic}/ws${params.length ? "?" + params.join("&") : ""}`;
}

export function useNtfy({ serverUrl, topic, token, role, onAlert }: UseNtfyOptions) {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const connect = useCallback(() => {
    if (!serverUrl || !topic) return;

    try {
      // Load last-seen timestamp so ntfy replays messages we missed while offline
      const since = getLastSeen(topic);
      const wsUrl = buildWsUrl(serverUrl, topic, since, token);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => setConnected(true);

      ws.onmessage = (event) => {
        try {
          const msg: NtfyMessage = JSON.parse(event.data);
          if (msg.event !== "message") return;

          // Update last-seen so next reconnect starts from here
          if (msg.time > getLastSeen(topic)) {
            setLastSeen(topic, msg.time);
          }

          const alert: Alert = {
            id: msg.id,
            title: msg.title || "",
            message: msg.message || "",
            priority: (msg.priority || 3) as Priority,
            tags: msg.tags || [],
            role,
            topic: msg.topic,
            time: msg.time,
            acked: false,
            silenced: false,
            actions: msg.actions as Alert["actions"],
          };

          onAlert(alert);
        } catch {
          /* ignore malformed messages */
        }
      };

      ws.onclose = () => {
        setConnected(false);
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => ws.close();
    } catch {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [serverUrl, topic, token, role, onAlert]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { connected };
}
