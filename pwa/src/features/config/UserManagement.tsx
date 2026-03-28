import { useState, useEffect, useCallback } from "react";
import { Button } from "@/shared/ui/Button";
import type { AuthUser } from "@/types/auth";

interface UserManagementProps {
  runnerUrl: string;
  token: string;
  currentUser: string;
}

interface ApiUser {
  username: string;
  role: string;
  totp_enabled: boolean;
}

export function UserManagement({ runnerUrl, token, currentUser }: UserManagementProps) {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  // Add form state
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"ops" | "dev">("dev");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${runnerUrl}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) {
        setError("Failed to load users");
        return;
      }
      const data = await resp.json();
      setUsers(data.users || []);
    } catch {
      setError("Connection failed");
    } finally {
      setLoading(false);
    }
  }, [runnerUrl, token]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDelete = async (username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;
    try {
      const resp = await fetch(`${runnerUrl}/api/auth/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) {
        setUsers((prev) => prev.filter((u) => u.username !== username));
      } else {
        const data = await resp.json();
        setError(data.detail || "Delete failed");
      }
    } catch {
      setError("Connection failed");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdding(true);
    setAddError("");
    try {
      const resp = await fetch(`${runnerUrl}/api/auth/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setAddError(data.detail || "Failed to create user");
        return;
      }
      setUsers((prev) => [...prev, data.user]);
      setNewUsername("");
      setNewPassword("");
      setNewRole("dev");
      setShowAdd(false);
    } catch {
      setAddError("Connection failed");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Users
        </span>
        <button
          className="text-xs text-blue-400 hover:text-blue-300"
          onClick={() => setShowAdd((v) => !v)}
        >
          {showAdd ? "Cancel" : "+ Add user"}
        </button>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {showAdd && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-slate-800/50 rounded-lg p-3">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Username"
            required
            maxLength={32}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Password (min 6 chars)"
            required
            minLength={6}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value as "ops" | "dev")}
            className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="dev">dev — sees dev alerts only</option>
            <option value="ops">ops — full access</option>
          </select>
          {addError && <p className="text-xs text-red-400">{addError}</p>}
          <Button type="submit" size="sm" disabled={adding}>
            {adding ? "Creating..." : "Create user"}
          </Button>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Loading...</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {users.map((u) => (
            <li
              key={u.username}
              className="flex items-center justify-between bg-slate-800/40 rounded px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm truncate">{u.username}</span>
                <span className="text-xs text-slate-500 shrink-0">{u.role}</span>
                {u.totp_enabled && (
                  <span className="text-xs text-emerald-500 shrink-0" title="2FA enabled">
                    2FA
                  </span>
                )}
                {u.username === currentUser && (
                  <span className="text-xs text-blue-400 shrink-0">you</span>
                )}
              </div>
              {u.username !== currentUser && (
                <button
                  className="text-xs text-slate-600 hover:text-red-400 transition-colors ml-2 shrink-0"
                  onClick={() => handleDelete(u.username)}
                  title="Delete user"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
          {users.length === 0 && !loading && (
            <li className="text-xs text-slate-500">No users found</li>
          )}
        </ul>
      )}
    </div>
  );
}
