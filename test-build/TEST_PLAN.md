# AlertPilot — Test Plan

## Prerequisites

```bash
cd test-build
docker compose -f docker-compose.test.yml up --build -d
# Wait 15 seconds for services to start
sleep 15
```

---

## Part 1: Automated Tests (CLI)

Run all automated tests:

```bash
bash scripts/run_all.sh
```

This covers:
- [x] Health checks (ntfy, runner, PWA)
- [x] Auth flow (setup, login, session, bad password)
- [x] Schema (all 16 actions discovered, trigger matching)
- [x] Action execution (restart, scale, silence + validation errors)
- [x] ntfy pub/sub (publish, read cached)
- [x] Webhooks (Stripe, 3DS, generic)
- [x] Hot reload, unauthorized access, CORS

If everything passes, move to Part 2.

---

## Part 2: PWA Manual Testing

Open **http://localhost:8080** in browser.

### 2.1 First-time Setup

- [1] Page loads — shows "Enter your server details" screen
- [1] Enter ntfy URL: `http://localhost:8080/ntfy`
- [1] Enter Runner URL: `http://localhost:8080/runner`
- [1] Screen changes to "Create your admin account"
- [1] Create account (username: admin, password: test1234)
- [1] Redirects to main app

### 2.2 Main Interface

- [1] Header shows "AlertPilot" with connection indicators
- [1] Two green dots (ops + dev WebSocket connected)
- [1] Username "admin" shown in header
- [1] OPS tab active by default
- [ ] Services grid visible (5 services: nginx, api, worker, postgres, redis)
- [ ] Quick Actions panel visible (Restart nginx, Restart api, Scale...)
- [ ] "No alerts yet" message in feed

### 2.3 Service Grid (OPS tab)

- [ ] Click a service dot — cycles through ok → warn → down → unknown
- [ ] All 5 services shown in grid

### 2.4 Send Test Alerts

Open a second terminal and run:

```bash
# Normal ops alert
curl -H "Title: Disk space low on db-1" -H "Priority: 4" -H "Tags: warning" \
  -d "Disk usage at 92% on /dev/sda1" http://localhost:8080/ntfy/ops-alerts

# Urgent ops alert (should trigger restart button)
curl -H "Title: nginx returned 502" -H "Priority: 5" -H "Tags: rotating_light" \
  -d "Backend not responding for 30 seconds" http://localhost:8080/ntfy/ops-alerts

# Dev alert
curl -H "Title: Build failed: main branch" -H "Priority: 4" -H "Tags: x" \
  -d "Step 'npm test' failed with exit code 1" http://localhost:8080/ntfy/dev-alerts

# Low priority info
curl -H "Title: Deploy completed: api v2.4.1" -H "Priority: 2" -H "Tags: white_check_mark" \
  -d "Deployed to production successfully" http://localhost:8080/ntfy/ops-alerts

# Memory alert (should trigger scale button)
curl -H "Title: High memory usage" -H "Priority: 4" -H "Tags: warning" \
  -d "API service using 95% memory, consider scaling" http://localhost:8080/ntfy/ops-alerts
```

### 2.5 Alert Feed

- [ ] All 5 alerts appear in the feed
- [ ] Sorted by time (newest first)
- [ ] Priority badges: urgent (red), high (orange), normal (blue), low (gray)
- [ ] Role badges: ops (amber), dev (blue)
- [ ] Time shown as "Xs ago" / "Xm ago"

### 2.6 Contextual Action Buttons

- [ ] "nginx 502" alert shows "Restart ..." button
- [ ] "High memory" alert shows "Scale ..." button
- [ ] Low-priority deploy alert shows NO contextual buttons
- [ ] Click "Restart ..." → confirmation modal appears
- [ ] Modal shows description text
- [ ] Cancel button closes modal
- [ ] Confirm button → executes (will fail gracefully) → result notification appears in feed

### 2.7 Universal Buttons

- [ ] Every alert card has "Ack" and "Silence" buttons
- [ ] Click "Ack" → button changes to "Acked", card fades (opacity 50%)
- [ ] Click "Silence" → button changes to "Silenced", card fades more (opacity 30%)

### 2.8 Role Switching

- [ ] Switch to DEV tab
- [ ] Services grid and Quick Actions disappear
- [ ] Only dev alert visible ("Build failed")
- [ ] Counter on DEV tab shows "1"
- [ ] Switch back to OPS — all ops alerts visible
- [ ] Counter on OPS tab shows correct count

### 2.9 Quick Actions (OPS tab)

- [ ] Click "Restart nginx" → executes (may fail, check result notification)
- [ ] Click "Scale..." → modal opens
- [ ] Select service from dropdown
- [ ] Use +/- to change replicas
- [ ] Click "Scale" → executes

### 2.10 Settings Panel

- [ ] Click "Settings" → bottom sheet slides up
- [ ] ntfy URL shown
- [ ] Topics shown (ops-alerts, dev-alerts)
- [ ] Runner URL shown
- [ ] "Signed in as admin" at bottom
- [ ] "Sign out" button works → redirects to login

### 2.11 Login/Logout Flow

- [ ] After sign out, login screen appears
- [ ] Enter credentials → login succeeds → back to app
- [ ] Alerts are gone (in-memory only — expected)

### 2.12 Webhooks (via CLI)

```bash
# Stripe payment
curl -X POST http://localhost:8080/runner/api/webhook/stripe \
  -H "Content-Type: application/json" \
  -d '{"type":"payment_intent.succeeded","data":{"object":{"amount":4999,"currency":"usd","customer_email":"user@test.com"}}}'

# 3DS code (fields at root level — webhook action reads payload.get("code"))
curl -X POST http://localhost:8080/runner/api/webhook/tds_code \
  -H "Content-Type: application/json" \
  -d '{"code":"482910","bank":"TestBank","amount":"2500 USD","merchant":"Amazon"}'

# Generic webhook
curl -X POST http://localhost:8080/runner/api/webhook/custom \
  -H "Content-Type: application/json" \
  -d '{"title":"Sensor alert","message":"Temperature exceeded threshold","priority":4}'
```

- [ ] Stripe: notification appears in feed "Payment received: $49.99 USD"
- [ ] 3DS: URGENT notification "Code: 482910" with bank info
- [ ] Generic: notification "Sensor alert" appears

---

## Part 3: PWA Features

### 3.1 Install as PWA

- [ ] (Chrome) Install banner should appear OR use browser menu → "Install app"
- [ ] App opens in standalone window (no address bar)
- [ ] App icon on taskbar/home screen

### 3.2 Push Notifications (if VAPID configured)

Skip this section if NTFY_WEB_PUSH keys are not set.

- [ ] Purple banner "Enable push notifications" appears
- [ ] Click "Enable" → browser asks permission
- [ ] Accept → purple dot appears in header
- [ ] Close the app completely
- [ ] Send alert from CLI
- [ ] Phone/desktop shows native notification
- [ ] Click notification → app opens

---

## Part 4: Edge Cases

- [ ] Send 50+ alerts rapidly — PWA handles without lag (max 200 in memory)
- [ ] Disconnect network → reconnect → WebSocket auto-reconnects (check green dots)
- [ ] Refresh page → auth persists (JWT in localStorage)
- [ ] Open in incognito → shows login screen (no stored JWT)

---

## Cleanup

```bash
docker compose -f docker-compose.test.yml down -v
```

This removes all containers and test volumes.
