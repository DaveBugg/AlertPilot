# AlertPilot

Self-hosted action-on-alert framework. Receive events via HTTP, push to any device, execute actions from notification.

## Architecture

```
[Any Source] → HTTP POST → [ntfy] → WebSocket → [PWA]
                                                   ↓ (action button click)
                                              [Runner] → runbook/command → result → [ntfy]
```

Four containers: **ntfy** (transport), **PWA** (React UI), **Runner** (Python/FastAPI actions), **Caddy** (reverse proxy + TLS).

## Stack

- Runner: Python 3.12, FastAPI, httpx
- PWA: React 19, TypeScript, Vite, Tailwind CSS
- Infra: Docker Compose, Caddy, ntfy

## Project Structure

```
runner/
├── core/              # Framework core (DO NOT modify without understanding)
│   ├── base_action.py # BaseRunnerAction ABC — all actions inherit from this
│   ├── router.py      # ActionRouter — auto-discovers actions from actions/ recursively
│   ├── context.py     # ActionContext — passed to execute()
│   ├── result.py      # ActionResult — success/failure return type
│   └── ntfy_client.py # NtfyClient — lazy-init HTTP client for ntfy (no global singleton)
├── actions/           # Drop-in actions organized by category subdirectories
│   ├── devops/        # restart, scale, silence
│   ├── cicd/          # rollback, approve, rerun
│   ├── security/      # block_ip, revoke_token
│   ├── smarthome/     # thermostat, lights
│   ├── webhooks/      # stripe, tds_code, generic
│   ├── business/      # pause_campaign, notify_oncall
│   └── database/      # failover, backup
├── runbooks/          # Bash scripts (optional, per-action)
├── config.py          # Settings from env vars
└── main.py            # FastAPI app

pwa/src/
├── types/             # TypeScript types (alert, action, service)
├── hooks/             # React hooks (useNtfy, useAlerts, useActions, useConfig)
├── features/          # Feature modules
│   ├── alerts/        # AlertFeed, AlertCard, ActionButtons
│   ├── services/      # ServiceGrid (ops only)
│   ├── quick-actions/ # QuickActions panel (ops only)
│   └── config/        # ConfigPanel (bottom sheet)
└── shared/ui/         # Reusable UI components (Badge, Button, Modal, Sheet)
```

## Adding a Runner Action

1. Create `runner/actions/{category}/{name}.py`
2. Inherit `BaseRunnerAction`
3. Set class attributes: `name`, `label`, `category`, `description`, `triggers`, `params_schema`
4. Implement `async def execute(self, ctx: ActionContext) -> ActionResult`
5. Optional: create `runner/runbooks/{name}_{service}.sh`
6. Restart runner (or call `POST /api/reload`)

### Action Template

```python
from runner.core import BaseRunnerAction, ActionContext, ActionResult

class MyAction(BaseRunnerAction):
    name = "my_action"
    label = "Do something to {target}"
    category = "custom"
    description = "One-line description for schema and docs"
    triggers = ["keyword1", "keyword2"]  # Auto-attach to alerts containing these
    confirm = True                        # Require user confirmation
    timeout = 30                          # Seconds before timeout
    roles = ["ops"]                       # Which PWA roles see this action
    params_schema = {
        "target": {"type": "string", "required": True},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        target = ctx.params["target"]
        result = await self.run_runbook_or_default(
            f"my_action_{target}",
            fallback=f"echo 'Executed on {target}'",
        )
        # Custom notification — prevents auto-notify from main.py
        await self.notify(ctx, result=result, title=f"Done: {target}", body=result.output)
        return result
```

### Notification strategy

- If your action calls `self.notify(ctx, result=result, ...)`, it sets `_notified` flag — main.py will NOT send a second notification.
- If your action does NOT call `self.notify()`, main.py auto-sends a generic success/failure notification.
- Webhook actions (tds_code, stripe, generic) always self-notify with custom formatting.

### Key Methods in BaseRunnerAction

- `self.validate_params(params)` — validate against params_schema (type, required, min/max, enum, pattern, whitelist)
- `self.validate_whitelist(service)` — check against SERVICE_WHITELIST env var
- `self.run_runbook_or_default(name, fallback)` — try runbook script, fallback to command
- `self.run_shell(cmd)` — execute shell command with timeout (kills process on timeout)
- `self.notify(ctx, result, title, body, priority, tags)` — send ntfy notification + mark as notified
- `self.schema()` — return action metadata dict

### params_schema validation

Params are validated automatically before `execute()` is called. Supported schema fields:

```python
params_schema = {
    "service": {"type": "string", "required": True, "whitelist": True},
    "replicas": {"type": "integer", "required": True, "min": 1, "max": 20},
    "state": {"type": "string", "required": True, "enum": ["on", "off"]},
    "ip": {"type": "string", "required": True, "pattern": r"^\d{1,3}(\.\d{1,3}){3}$"},
    "zone": {"type": "string", "required": False, "default": "main"},
}
```

## Runner API Endpoints

- `GET /api/schema` — all actions metadata (PWA loads this on startup)
- `GET /api/schema/triggers?text=...` — match alert text to actions
- `POST /api/action/{name}` — execute action (Bearer token required)
- `POST /api/webhook/{source}` — receive external webhook (maps to actions/webhooks/)
- `POST /api/reload` — hot-reload actions from disk
- `GET /health` — health check

## PWA Architecture

- Two WebSocket connections (ops + dev topics) always active
- WebSocket auth via `?auth=Bearer%20TOKEN` query param (ntfy standard)
- Role switcher filters the unified alert feed, doesn't disconnect
- Action buttons are dynamic — rendered from `GET /api/schema` + trigger matching
- All config in localStorage — zero server-side state for PWA
- Service Worker handles push notifications when app is closed

## Adding a PWA Feature

1. Create `pwa/src/features/{name}/`
2. Follow pattern from `features/alerts/`
3. Import in `App.tsx`

## Conventions

- Action names: `snake_case`, must match across filename and `name` attribute
- Runbooks: `{action}_{target}.sh` in `runner/runbooks/`
- PWA components: PascalCase, co-located in feature dirs
- All runner strings in English
- Params are validated by framework — actions can trust `ctx.params` in execute()
- Actions MAY call `self.notify()` for custom notifications, otherwise auto-notify kicks in

## Docker

```bash
# Configure
cp .env.example .env
# Edit .env — set DOMAIN, RUNNER_SECRET, etc.

# Start everything
docker compose up -d

# Create ntfy users (one-time setup)
docker compose exec ntfy ntfy user add --role=admin admin
docker compose exec ntfy ntfy user add ops-user
docker compose exec ntfy ntfy user add dev-user
docker compose exec ntfy ntfy user add bot

docker compose exec ntfy ntfy access ops-user 'ops-alerts' rw
docker compose exec ntfy ntfy access ops-user 'dev-alerts' ro
docker compose exec ntfy ntfy access dev-user 'dev-alerts' ro
docker compose exec ntfy ntfy access bot 'ops-alerts' wo
docker compose exec ntfy ntfy access bot 'dev-alerts' wo

# Generate bot token (use in .env as NTFY_BOT_TOKEN)
docker compose exec ntfy ntfy token add bot
```

## Sending Alerts

```bash
# Minimal alert
curl -d "Disk full on db-1" https://your.host/ntfy/ops-alerts

# Full alert with action button
curl \
  -H "Title: nginx returned 502" \
  -H "Priority: 5" \
  -H "Tags: rotating_light" \
  -d "Backend is not responding" \
  https://your.host/ntfy/ops-alerts

# Webhook (processed by runner, then forwarded to ntfy)
curl -X POST https://your.host/runner/api/webhook/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"payment_intent.succeeded","data":{"object":{"amount":5000,"currency":"usd"}}}'
```
