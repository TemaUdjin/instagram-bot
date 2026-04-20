# Instagram DM Bot

Receives Instagram DMs, forwards to Telegram with an AI-suggested reply (Claude). You approve or write your own reply. Deployed on Railway.

---

## Current working config

| Variable | Value | Notes |
|---|---|---|
| `PAGE_ACCESS_TOKEN` | `IGAAUwzY0D3TNBZ...` | IGAA long-lived token. Starts with `IGAA`. |
| `BUSINESS_ACCOUNT_ID` | `17841400228014487` | Instagram Business Account ID |
| `PAGE_ID` | `279920309492026` | Facebook Page ID |
| `VERIFY_TOKEN` | `my_secret_token_123` | Matches Meta webhook config |
| Webhook URL | `https://web-production-6ed0b.up.railway.app/webhook` | Set in Meta App Dashboard |
| Send endpoint | `POST graph.instagram.com/v19.0/{BUSINESS_ACCOUNT_ID}/messages` | Requires IGAA token |

---

## How to use

When a client sends a DM to your Instagram:

1. Telegram receives a notification with the client's name, username, and message
2. Claude suggests a reply in your coaching style
3. Send `+` in Telegram to approve it, or type your own text
4. Reply is sent to the client on Instagram

**24-hour rule:** Instagram only allows replies within 24 hours of the client's last message. After that, the conversation window closes and sends will fail with "user not found".

---

## Token expiry and renewal

The `PAGE_ACCESS_TOKEN` (IGAA type) expires approximately every 60 days.

**How to check if it's expired:**
```
https://web-production-6ed0b.up.railway.app/debug-token
```

If `valid: false` — the token has expired and needs to be replaced.

**How to get a new token:**

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Open your app → Instagram → Generate Token
3. Grant all permissions: `instagram_manage_messages`, `instagram_basic`, `pages_messaging`
4. Copy the new token (starts with `IGAA`)

**Where to paste it:**

1. Open [railway.app](https://railway.app) → Project `divine-connection` → Variables
2. Find `PAGE_ACCESS_TOKEN` and replace the value
3. Railway will redeploy automatically in ~30 seconds

---

## Diagnostic endpoints

| Endpoint | What it checks |
|---|---|
| `/health` | Token validity, Claude API, Telegram — full system status |
| `/debug-token` | Token type, validity, permissions list |
| `/test-claude` | Claude API — generates a sample reply |
| `/test-telegram` | Sends a test message to your Telegram |
| `/test-user/:userId` | Looks up an Instagram user by ID |

---

## How to redeploy

**Via Railway dashboard:**
- Go to [railway.app](https://railway.app) → `divine-connection` → Deployments → Redeploy

**Via Railway API (automatic):**
Railway redeploys automatically when:
- A variable changes
- A new commit is pushed to the `main` branch on GitHub

---

## Environment variables (full list)

```
PAGE_ACCESS_TOKEN     — IGAA token from Meta (starts with IGAA)
BUSINESS_ACCOUNT_ID  — Instagram Business Account ID: 17841400228014487
PAGE_ID              — Facebook Page ID: 279920309492026
VERIFY_TOKEN         — Webhook secret: my_secret_token_123
TELEGRAM_TOKEN       — From @BotFather
CHAT_ID              — Your Telegram chat ID
ANTHROPIC_API_KEY    — From console.anthropic.com
```

See `.env.example` for the full template.

---

## What to do when something breaks

**Token expired (`valid: false` in /debug-token):**
→ Generate a new IGAA token in Meta, paste into Railway `PAGE_ACCESS_TOKEN`

**Claude not responding (`claude: false` in /health):**
→ Check Anthropic balance at console.anthropic.com → Usage

**Telegram not receiving messages (`telegram: false` in /health):**
→ Check that the Telegram webhook is set: `https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://web-production-6ed0b.up.railway.app/telegram`

**Instagram send failing ("user not found"):**
→ The 24-hour window closed. The client needs to send a new message first.

**Instagram send failing ("object does not exist"):**
→ Wrong token type in Railway. Token must start with `IGAA`, not `EAAX`.

---

## Project structure

```
index.js          — Main server (Express)
package.json      — Dependencies
railway.json      — Railway build config
nixpacks.toml     — Node version and start command
.env              — Local secrets (not in git)
.env.example      — Template for variables
README.md         — This file
conversations.json — Saved approved replies (auto-created)
```
