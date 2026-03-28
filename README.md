# AlertPilot

Self-hosted action-on-alert framework. Receive events from anything via HTTP, get them on your phone as push notifications, and execute actions directly from the notification — restart a service, scale a container, block an IP, run a runbook — all without opening a terminal.

```
[Any Source] → HTTP POST → [ntfy] → WebSocket → [PWA]
                                                    ↓ (tap action button)
                                              [Runner] → runbook / command → result → [ntfy]
```

## Why

Most alerting tools are either too heavy (PagerDuty, OpsGenie) or too dumb (just send a message). AlertPilot sits in the middle: lightweight enough to self-host on a $5 VPS, smart enough to let you act on alerts without SSH-ing into anything.

## What it does

- **Receives alerts** from any source that can make an HTTP POST (Grafana, Prometheus, GitHub Actions, cron jobs, your own scripts)
- **Pushes them** to your phone/desktop as native notifications via a PWA — even when the browser is closed
- **Lets you act** on alerts with one tap: action buttons appear automatically based on keywords in the alert text
- **Persists state** — ack, silence, delete alerts. State synced per-user across devices via SQLite on the runner
- **Replays missed alerts** — ntfy caches messages for 12h, PWA fetches them on reconnect via `?since=`

## Stack

| Component | Tech |
|-----------|------|
| **PWA** | React 19, TypeScript, Vite, Tailwind CSS |
| **Runner** | Python 3.12, FastAPI, SQLite |
| **Transport** | [ntfy](https://ntfy.sh) (self-hosted) |
| **Proxy** | Caddy (auto TLS via Let's Encrypt) |
| **Infra** | Docker Compose |

## Quick start

```bash
git clone https://github.com/YOUR_USER/alertpilot.git
cd alertpilot
cp .env.example .env
```

Edit `.env` — at minimum set:
```env
DOMAIN=alerts.your.host
RUNNER_SECRET=your-secret
NTFY_BOT_TOKEN=tk_...        # generate after first start
VITE_NTFY_URL=https://alerts.your.host/ntfy
VITE_RUNNER_URL=https://alerts.your.host/runner
```

```bash
docker compose up -d

# One-time: create ntfy users
docker compose exec ntfy ntfy user add --role=admin admin
docker compose exec ntfy ntfy user add ops-user
docker compose exec ntfy ntfy user add dev-user
docker compose exec ntfy ntfy user add bot

docker compose exec ntfy ntfy access ops-user ops-alerts rw
docker compose exec ntfy ntfy access ops-user dev-alerts ro
docker compose exec ntfy ntfy access dev-user dev-alerts ro
docker compose exec ntfy ntfy access bot ops-alerts wo
docker compose exec ntfy ntfy access bot dev-alerts wo

# Generate bot token → paste as NTFY_BOT_TOKEN in .env → docker compose up -d
docker compose exec ntfy ntfy token add bot
```

Open `https://alerts.your.host` — create your admin account on first visit.

## Local testing (no domain, no TLS)

```bash
cd test-build
docker compose -f docker-compose.test.yml up --build
```

Open `http://localhost:8080`. Everything pre-configured, auth open (no tokens needed).

## Sending alerts

```bash
# Minimal
curl -d "Disk full on db-1" https://alerts.your.host/ntfy/ops-alerts

# With title and priority (5 = urgent)
curl \
  -H "Title: nginx returned 502" \
  -H "Priority: 5" \
  -H "Tags: rotating_light" \
  -d "Backend not responding on prod-1" \
  https://alerts.your.host/ntfy/ops-alerts

# Webhook (Stripe, 3DS, generic)
curl -X POST https://alerts.your.host/runner/api/webhook/stripe \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-secret" \
  -d '{"type":"payment_intent.succeeded","data":{"object":{"amount":5000}}}'
```

## Built-in actions (17)

| Category | Actions |
|----------|---------|
| **DevOps** | `restart` — restart service, `scale` — set replica count, `silence` — mute alerts |
| **CI/CD** | `rollback` — revert deployment, `approve_deploy` — approve pipeline, `rerun_pipeline` — retry failed run |
| **Security** | `block_ip` — add IP to blocklist, `revoke_token` — invalidate API token |
| **Database** | `db_failover` — promote replica, `db_backup` — trigger backup |
| **Business** | `notify_oncall` — page on-call person, `pause_campaign` — pause ad/email campaign |
| **Smart Home** | `lights` — control lights, `thermostat` — set temperature |
| **Webhooks** | `stripe` — payment events, `tds_code` — 3DS auth codes, `generic_webhook` — catch-all |

Actions are **auto-matched** to alerts by keyword triggers. Send an alert containing "nginx" and the restart/scale buttons appear automatically.

## Adding your own action

Create `runner/actions/{category}/{name}.py`:

```python
from runner.core import BaseRunnerAction, ActionContext, ActionResult

class MyAction(BaseRunnerAction):
    name = "my_action"
    label = "Do something to {service}"
    category = "custom"
    description = "One-line description"
    triggers = ["keyword1", "keyword2"]  # auto-attach to matching alerts
    confirm = True                        # ask user before executing
    params_schema = {
        "service": {"type": "string", "required": True, "whitelist": True},
    }

    async def execute(self, ctx: ActionContext) -> ActionResult:
        result = await self.run_runbook_or_default(
            f"my_action_{ctx.params['service']}",
            fallback=f"echo 'done'",
        )
        return result
```

Then `POST /runner/api/reload` or restart the container. No rebuild needed.

Optionally create `runner/runbooks/my_action_nginx.sh` — the framework will find and execute it automatically.

## Architecture

```
internet
   │
   ▼
[Caddy :443]
   ├── /ntfy/   → ntfy:80        (pub/sub, WebSocket, Web Push)
   ├── /runner/ → runner:8000    (FastAPI actions + auth)
   └── /        → pwa:80         (React PWA, served by nginx)

[Runner]
   ├── /api/auth/*     JWT login, setup, TOTP, user management
   ├── /api/schema     action metadata (PWA loads on startup)
   ├── /api/action/*   execute action (Bearer JWT required)
   ├── /api/alerts/*   ack/silence/delete per-user (SQLite)
   └── /api/webhook/*  receive external webhooks
```

## Auth & security

- **JWT** (HS256) with bcrypt passwords. Auto-generated secret on first run.
- **TOTP / 2FA** — optional per-user, verified at login.
- **Role-based**: `ops` sees everything + can manage users + run actions. `dev` sees dev-alerts only.
- **ntfy auth**: `deny-all` by default in production — each user needs their own ntfy token.
- **Webhook secret**: optional `X-Webhook-Secret` header check via `WEBHOOK_SECRET` env var.
- **CORS**: configurable via `CORS_ORIGINS` env var (defaults to same-origin).

## Web Push (background notifications)

When the app is closed, ntfy can still push alerts to your device via the browser's native push service (no app install needed — PWA + Service Worker).

```bash
# Generate VAPID keys (one-time)
docker compose exec ntfy ntfy webpush keys

# Add to .env and rebuild
NTFY_WEB_PUSH_PUBLIC_KEY=...
NTFY_WEB_PUSH_PRIVATE_KEY=...
docker compose up -d --build pwa
```

Then open Settings in the PWA → Enable push notifications.

## Custom port

```env
# .env
DOMAIN=alerts.your.host
WEB_PORT=50443
```

Caddy will listen on `50443` instead of `443`. Port `80` is always bound for ACME challenges.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOMAIN` | `localhost` | Your domain. Caddy auto-obtains TLS cert. |
| `WEB_PORT` | `443` | HTTPS port. Leave empty for standard 443. |
| `RUNNER_SECRET` | `changeme` | Bearer token for machine-to-machine access. |
| `WEBHOOK_SECRET` | _(empty)_ | Optional secret for webhook endpoint. |
| `NTFY_BOT_TOKEN` | _(empty)_ | ntfy token for runner → ntfy publishing. |
| `NTFY_OPS_TOPIC` | `ops-alerts` | Ops team alert topic. |
| `NTFY_DEV_TOPIC` | `dev-alerts` | Dev team alert topic. |
| `SERVICE_WHITELIST` | `nginx,api,...` | Services restart/scale can touch. |
| `ACTION_TIMEOUT` | `30` | Max seconds for action execution. |
| `VITE_NTFY_URL` | _(empty)_ | Baked into PWA — ntfy public URL. |
| `VITE_RUNNER_URL` | _(empty)_ | Baked into PWA — runner public URL. |
| `JWT_SECRET` | _(auto)_ | JWT signing key. Auto-generated if empty. |
| `JWT_EXPIRY_DAYS` | `30` | Session duration. |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins. |

## License

MIT
