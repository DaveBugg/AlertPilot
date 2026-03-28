import { useState } from "react";
import { Button } from "@/shared/ui/Button";
import type { LoginResponse } from "@/types/auth";

interface LoginScreenProps {
  setupRequired: boolean;
  error: string;
  onLogin: (username: string, password: string, totpCode?: string) => Promise<LoginResponse>;
  onSetup: (username: string, password: string) => Promise<boolean>;
}

export function LoginScreen({ setupRequired, error, onLogin, onSetup }: LoginScreenProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showTotp, setShowTotp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (setupRequired) {
        await onSetup(username, password);
      } else if (showTotp) {
        await onLogin(username, password, totpCode);
      } else {
        const result = await onLogin(username, password);
        if (result.totp_required) {
          setShowTotp(true);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">AlertPilot</h1>
          <p className="text-sm text-slate-400 mt-1">
            {setupRequired ? "Create your admin account" : "Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!showTotp ? (
            <>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                autoComplete="username"
                required
                className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete={setupRequired ? "new-password" : "current-password"}
                required
                minLength={6}
                className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
              />
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-slate-400 text-center">
                Enter the 6-digit code from your authenticator app
              </p>
              <input
                type="text"
                value={totpCode}
                onChange={(e) => {
                  // Only digits, max 6
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setTotpCode(v);
                }}
                placeholder="000000"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                required
                className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <Button type="submit" disabled={submitting}>
            {submitting
              ? "..."
              : setupRequired
                ? "Create account"
                : showTotp
                  ? "Verify"
                  : "Sign in"}
          </Button>

          {showTotp && (
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-slate-300"
              onClick={() => {
                setShowTotp(false);
                setTotpCode("");
              }}
            >
              Back to login
            </button>
          )}
        </form>

        {setupRequired && (
          <p className="text-xs text-slate-500 text-center mt-6">
            This is a one-time setup. You can add more users later.
          </p>
        )}
      </div>
    </div>
  );
}
