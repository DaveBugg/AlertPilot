import { useState, useEffect, useCallback } from "react";
import type { ActionSchema, SchemaResponse, ActionResult } from "@/types/action";
import type { AppConfig } from "./useConfig";

/**
 * useActions now accepts an auth token (JWT) instead of relying on runnerSecret.
 * Falls back to runnerSecret for backward compat / machine-to-machine.
 */
export function useActions(config: AppConfig, authToken?: string) {
  const [actions, setActions] = useState<Record<string, ActionSchema>>({});
  const [loading, setLoading] = useState(false);

  const bearerToken = authToken || config.runnerSecret;

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (bearerToken) {
      h["Authorization"] = `Bearer ${bearerToken}`;
    }
    return h;
  }, [bearerToken]);

  // Load schema from runner
  const loadSchema = useCallback(async () => {
    if (!config.runnerUrl || !bearerToken) return;
    setLoading(true);
    try {
      const resp = await fetch(`${config.runnerUrl}/api/schema`, {
        headers: authHeaders(),
      });
      if (resp.ok) {
        const data: SchemaResponse = await resp.json();
        setActions(data.actions || {});
      }
    } catch (err) {
      console.error("Failed to load action schema:", err);
    } finally {
      setLoading(false);
    }
  }, [config.runnerUrl, bearerToken, authHeaders]);

  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  // Execute an action on the runner
  const executeAction = useCallback(
    async (
      actionName: string,
      params: Record<string, unknown>,
      topic?: string
    ): Promise<ActionResult> => {
      const resp = await fetch(
        `${config.runnerUrl}/api/action/${actionName}`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            params,
            topic: topic || config.opsTopic,
          }),
        }
      );

      if (!resp.ok) {
        const text = await resp.text();
        return { ok: false, output: "", error: text, data: {} };
      }

      return resp.json();
    },
    [config.runnerUrl, config.opsTopic, authHeaders]
  );

  // Match triggers for alert text
  const matchTriggers = useCallback(
    (text: string): ActionSchema[] => {
      const lower = text.toLowerCase();
      return Object.values(actions).filter((a) =>
        a.triggers.some((t) => lower.includes(t.toLowerCase()))
      );
    },
    [actions]
  );

  return { actions, loading, loadSchema, executeAction, matchTriggers };
}
