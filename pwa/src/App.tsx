import { useState, useCallback, useEffect } from "react";
import { useConfig } from "@/hooks/useConfig";
import { useAuth } from "@/hooks/useAuth";
import { useAlerts } from "@/hooks/useAlerts";
import { useNtfy } from "@/hooks/useNtfy";
import { useActions } from "@/hooks/useActions";
import { useWebPush } from "@/hooks/useWebPush";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { AlertFeed } from "@/features/alerts/AlertFeed";
import { ServiceGrid } from "@/features/services/ServiceGrid";
import { QuickActions } from "@/features/quick-actions/QuickActions";
import { ConfigPanel } from "@/features/config/ConfigPanel";
import { UserManagement } from "@/features/config/UserManagement";
import { Sheet } from "@/shared/ui/Sheet";
import { Button } from "@/shared/ui/Button";
import { cn } from "@/shared/lib/cn";
import type { Role } from "@/types/alert";

type Tab = "ops" | "dev";

export function App() {
  const { config, setConfig, isConfigured } = useConfig();
  const auth = useAuth(config);

  // If runner URL not configured, show config panel
  if (!isConfigured) {
    return <SetupScreen config={config} setConfig={setConfig} />;
  }

  // Auth gate — show login until authenticated
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  if (!auth.user) {
    return (
      <LoginScreen
        setupRequired={auth.setupRequired}
        error={auth.error}
        onLogin={auth.login}
        onSetup={auth.setup}
      />
    );
  }

  // Authenticated — render main app
  return (
    <AuthenticatedApp
      config={config}
      setConfig={setConfig}
      auth={auth}
    />
  );
}

/** Main app — only rendered when authenticated */
function AuthenticatedApp({
  config,
  setConfig,
  auth,
}: {
  config: ReturnType<typeof useConfig>["config"];
  setConfig: ReturnType<typeof useConfig>["setConfig"];
  auth: ReturnType<typeof useAuth>;
}) {
  const { alerts, addAlert, ackAlert, silenceAlert, deleteAlert, deleteAlerts, filterByRole } =
    useAlerts({ runnerUrl: config.runnerUrl, token: auth.token });
  const { executeAction, matchTriggers } = useActions(config, auth.token);
  const push = useWebPush(config);

  const [activeTab, setActiveTab] = useState<Tab>("ops");
  const [configOpen, setConfigOpen] = useState(false);

  // Connect to both topics simultaneously
  const { connected: opsConnected } = useNtfy({
    serverUrl: config.ntfyUrl,
    topic: config.opsTopic,
    token: config.ntfyToken,
    role: "ops",
    onAlert: useCallback((a) => addAlert(a), [addAlert]),
  });

  const { connected: devConnected } = useNtfy({
    serverUrl: config.ntfyUrl,
    topic: config.devTopic,
    token: config.ntfyToken,
    role: "dev",
    onAlert: useCallback((a) => addAlert(a), [addAlert]),
  });

  const filteredAlerts = filterByRole(activeTab as Role);

  const handleExecute = async (name: string, params: Record<string, unknown>) => {
    await executeAction(name, params, config.opsTopic);
  };

  return (
    <div className="max-w-lg mx-auto min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-bold tracking-tight">AlertPilot</h1>
          <div className="flex items-center gap-2">
            {/* Connection indicators */}
            <div className="flex gap-1 items-center">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  opsConnected ? "bg-emerald-500" : "bg-slate-600"
                )}
                title={`ops: ${opsConnected ? "connected" : "disconnected"}`}
              />
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  devConnected ? "bg-blue-500" : "bg-slate-600"
                )}
                title={`dev: ${devConnected ? "connected" : "disconnected"}`}
              />
              {push.state === "subscribed" && (
                <div
                  className="w-2 h-2 rounded-full bg-purple-500"
                  title="Push notifications active"
                />
              )}
            </div>

            {/* User badge */}
            <span className="text-xs text-slate-400">
              {typeof auth.user === "object" && auth.user ? auth.user.username : ""}
            </span>

            <Button size="sm" variant="ghost" onClick={() => setConfigOpen(true)}>
              Settings
            </Button>
          </div>
        </div>

        {/* Role tabs */}
        <div className="flex gap-1 bg-slate-900 rounded-lg p-0.5">
          {(["ops", "dev"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex-1 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeTab === tab
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {tab.toUpperCase()}
              <span className="ml-1.5 text-xs opacity-60">
                {filterByRole(tab).length}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Push notification banner */}
      <PushBanner push={push} />

      {/* Content */}
      <main className="flex-1 px-4 py-3 flex flex-col gap-4">
        {activeTab === "ops" && (
          <>
            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Services
              </h2>
              <ServiceGrid />
            </section>

            <section>
              <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Quick Actions
              </h2>
              <QuickActions onExecute={handleExecute} />
            </section>
          </>
        )}

        <section>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Alerts
          </h2>
          <AlertFeed
            alerts={filteredAlerts}
            matchTriggers={matchTriggers}
            onAck={ackAlert}
            onSilence={silenceAlert}
            onDelete={deleteAlert}
            onDeleteMany={deleteAlerts}
            onExecuteAction={handleExecute}
          />
        </section>
      </main>

      {/* Install banner */}
      <InstallBanner />

      {/* Config sheet */}
      <Sheet open={configOpen} onClose={() => setConfigOpen(false)}>
        <ConfigPanel
          config={config}
          onChange={setConfig}
          push={push}
          onResetConfig={() => {
            setConfig({ ntfyUrl: "", runnerUrl: "" });
            setConfigOpen(false);
          }}
        />

        {/* User management — ops only */}
        {typeof auth.user === "object" && auth.user?.role === "ops" && (
          <>
            <hr className="border-slate-700 my-4" />
            <UserManagement
              runnerUrl={config.runnerUrl}
              token={auth.token}
              currentUser={auth.user.username}
            />
          </>
        )}

        <div className="mt-4 pt-4 border-t border-slate-700 flex justify-between items-center">
          <span className="text-xs text-slate-500">
            Signed in as <strong>{typeof auth.user === "object" && auth.user ? auth.user.username : ""}</strong>
          </span>
          <Button size="sm" variant="ghost" onClick={auth.logout}>
            Sign out
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/** Initial config screen — shown when runner URL is not set */
function SetupScreen({
  config,
  setConfig,
}: {
  config: ReturnType<typeof useConfig>["config"];
  setConfig: ReturnType<typeof useConfig>["setConfig"];
}) {
  const [ntfyUrl, setNtfyUrl] = useState(config.ntfyUrl);
  const [runnerUrl, setRunnerUrl] = useState(config.runnerUrl);

  const canContinue = ntfyUrl.trim().length > 0 && runnerUrl.trim().length > 0;

  const handleContinue = () => {
    setConfig({
      ntfyUrl: ntfyUrl.replace(/\/+$/, ""),
      runnerUrl: runnerUrl.replace(/\/+$/, ""),
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-center">AlertPilot</h1>
        <p className="text-sm text-slate-400 text-center">
          Enter your server details to get started.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">ntfy Server URL</span>
          <input
            type="text"
            value={ntfyUrl}
            onChange={(e) => setNtfyUrl(e.target.value)}
            placeholder="http://localhost:8080/ntfy"
            className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-slate-400">Runner URL</span>
          <input
            type="text"
            value={runnerUrl}
            onChange={(e) => setRunnerUrl(e.target.value)}
            placeholder="http://localhost:8080/runner"
            className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>

        <Button
          className="w-full mt-2"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          Continue
        </Button>

        <p className="text-xs text-slate-500 text-center">
          You can configure topics and tokens in Settings later.
        </p>
      </div>
    </div>
  );
}

/** Push notification permission banner */
function PushBanner({ push }: { push: ReturnType<typeof useWebPush> }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("push_dismissed") === "1"
  );

  if (push.state !== "prompt" && push.state !== "granted") return null;
  if (dismissed) return null;

  return (
    <div className="mx-4 mt-3 bg-purple-950/50 border border-purple-800 rounded-lg p-3 flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">Enable push notifications</p>
        <p className="text-xs text-slate-400">Get alerts even when the app is closed</p>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setDismissed(true);
            localStorage.setItem("push_dismissed", "1");
          }}
        >
          Later
        </Button>
        <Button size="sm" onClick={push.subscribe}>
          Enable
        </Button>
      </div>
    </div>
  );
}

/** PWA install prompt */
function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem("pwa_dismissed") === "1"
  );

  useEffect(() => {
    if (dismissed) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 p-4 safe-bottom z-30">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <p className="text-sm">Install AlertPilot for the best experience</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setDismissed(true);
              localStorage.setItem("pwa_dismissed", "1");
            }}
          >
            Later
          </Button>
          <Button
            size="sm"
            onClick={() => {
              deferredPrompt.prompt();
              setDeferredPrompt(null);
            }}
          >
            Install
          </Button>
        </div>
      </div>
    </div>
  );
}
