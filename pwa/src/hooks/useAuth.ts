import { useState, useCallback, useEffect } from "react";
import type { AuthUser, LoginResponse } from "@/types/auth";
import type { AppConfig } from "./useConfig";

const TOKEN_KEY = "alertpilot_jwt";

interface UseAuthReturn {
  /** null = loading, false = not auth'd, AuthUser = auth'd */
  user: AuthUser | null | false;
  token: string;
  setupRequired: boolean;
  loading: boolean;
  error: string;
  login: (username: string, password: string, totpCode?: string) => Promise<LoginResponse>;
  setup: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

export function useAuth(config: AppConfig): UseAuthReturn {
  const [user, setUser] = useState<AuthUser | null | false>(null); // null = loading
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const baseUrl = config.runnerUrl;

  // Save token to localStorage
  const saveToken = useCallback((t: string) => {
    setToken(t);
    if (t) {
      localStorage.setItem(TOKEN_KEY, t);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  // Check auth status on mount
  useEffect(() => {
    if (!baseUrl) {
      setLoading(false);
      setUser(false);
      return;
    }

    const check = async () => {
      setLoading(true);

      // 1. Check if setup is needed
      try {
        const statusResp = await fetch(`${baseUrl}/api/auth/status`);
        const statusCt = statusResp.headers.get("content-type") || "";
        if (!statusCt.includes("application/json")) {
          setError("Runner URL is incorrect (got HTML). Should end with /runner.");
          setUser(false);
          setLoading(false);
          return;
        }
        const status = await statusResp.json();
        if (status.setup_required) {
          setSetupRequired(true);
          setUser(false);
          setLoading(false);
          return;
        }
      } catch {
        // Runner unreachable — show login anyway
        setUser(false);
        setLoading(false);
        return;
      }

      // 2. Validate existing token
      if (token) {
        try {
          const sessionResp = await fetch(`${baseUrl}/api/auth/session`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (sessionResp.ok) {
            const data = await sessionResp.json();
            setUser(data.user);
            // Refresh token if provided
            if (data.token) saveToken(data.token);
            setLoading(false);
            return;
          }
        } catch {
          // Token invalid or expired
        }
        saveToken("");
      }

      setUser(false);
      setLoading(false);
    };

    check();
  }, [baseUrl, token, saveToken]);

  // Login
  const login = useCallback(
    async (username: string, password: string, totpCode?: string): Promise<LoginResponse> => {
      setError("");
      try {
        const resp = await fetch(`${baseUrl}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, totp_code: totpCode || "" }),
        });

        const contentType = resp.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          setError("Runner URL is incorrect — got HTML instead of JSON. Check the URL in settings (should end with /runner).");
          return { ok: false };
        }

        const data: LoginResponse = await resp.json();

        if (!resp.ok) {
          const detail = (data as any).detail || "Login failed";
          setError(detail);
          return { ok: false };
        }

        if (data.totp_required) {
          return { ok: false, totp_required: true };
        }

        if (data.ok && data.token && data.user) {
          saveToken(data.token);
          setUser(data.user);
          return data;
        }

        return { ok: false };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Connection failed";
        setError(msg);
        return { ok: false };
      }
    },
    [baseUrl, saveToken]
  );

  // Initial setup (first user)
  const setup = useCallback(
    async (username: string, password: string): Promise<boolean> => {
      setError("");
      try {
        const resp = await fetch(`${baseUrl}/api/auth/setup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });

        if (!resp.ok) {
          const data = await resp.json();
          setError(data.detail || "Setup failed");
          return false;
        }

        const data = await resp.json();
        saveToken(data.token);
        setUser(data.user);
        setSetupRequired(false);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Connection failed");
        return false;
      }
    },
    [baseUrl, saveToken]
  );

  // Logout
  const logout = useCallback(() => {
    saveToken("");
    setUser(false);
  }, [saveToken]);

  return { user, token, setupRequired, loading, error, login, setup, logout };
}
