# Instagram Bot — Project Context

## What this is

A Telegram-based mini-CRM for managing Instagram DMs.
Webhook receives Instagram messages → bot shows them in a single Telegram UI message → coach replies with approval.
Deployed on Railway. No frontend. One file: `index.js` (~1000 lines).

## Architecture

```
Instagram DM → /webhook (POST) → store in conversations.json
                               → notify Telegram UI (single message, edited in-place)

Telegram button click → /telegram (POST) → show dialog / confirm / send
Telegram text message → /telegram (POST) → custom reply flow

/health  — check token + Claude + Telegram status
/debug-token — check IG token permissions
```

## Key files

- `index.js` — entire app (Express, Telegram UI, IG API, Claude)
- `conversations.json` — runtime data (in-memory + file backup), **not committed**
- `style_profile.json` — approved sent messages as style training data, **not committed**
- `bot_state.json` — Telegram UI message ID, **not committed**
- `.env` — secrets, **never commit**
- `.env.example` — template for env vars

## Deploy workflow

```bash
node --check index.js   # always check syntax first
git add index.js
git commit -m "..."
git push origin main    # Railway auto-deploys on push
```

Health check after deploy: `curl https://web-production-6ed0b.up.railway.app/health`

## Environment variables

| Var | Purpose |
|-----|---------|
| `PAGE_ACCESS_TOKEN` | Instagram long-lived token (starts with IGAA) |
| `BUSINESS_ACCOUNT_ID` | Instagram business page ID |
| `PAGE_ID` | Not set — bot dynamically fetches real IG account ID at startup |
| `TELEGRAM_TOKEN` | Bot token |
| `CHAT_ID` | Owner's Telegram user ID (784663861) |
| `VERIFY_TOKEN` | Webhook verification secret |
| `ANTHROPIC_API_KEY` | Claude API key |

## Critical rules (learned from production)

- `AUTO_SEND = false` — every reply requires manual confirmation. Never change this.
- `resolvedSelfIds` — fetched at startup from IG API. PAGE_ID alone is not reliable.
- All data is in-memory (`conversationsCache`). Railway filesystem is ephemeral.
- Telegram UI = ONE message (edited in-place). Never spam new messages for UI updates.
- Self-messages detected by: `is_echo === true` OR `senderId ∈ resolvedSelfIds`.
- Inbox only shows threads with at least one `type: 'incoming'` message.
- Style learning: `saveStyleExample()` only called after `confirm_send` success.

## Telegram UI screens

- **Inbox** — list of recent conversations, `[ 🔄 Refresh ]` always at bottom
- **Dialog** — history (5 msgs) + 3 AI suggestions + action buttons
- **Confirm** — "Sending to: Name" + `[ ✅ Confirm Send ]` `[ ❌ Cancel ]`
- **Custom reply** — user types text, goes to Confirm
- **View Sent** — last 20 outgoing for that user

## Callback data format

```
inbox               → show inbox
dialog_<senderId>   → open dialog for user
send_<0|1|2>        → go to confirm with suggestion N
edit_<0|1|2>        → edit suggestion N (custom reply with prefill)
custom              → custom reply
mark_client         → set status = Client
followup            → re-render dialog (no status change)
ignore_conv         → set status = Ignored
view_sent_<id>      → show sent messages
open_notif_<id>     → open dialog from notification
ignore_notif_<id>   → dismiss notification
confirm_send        → actually send to Instagram
```

## Conversation status flow

```
New → (reply sent) → Replied
New/Replied → (mark_client) → Client
Any → (ignore) → Ignored
Ignored → (new message from user) → New (auto-restored)
```

## What NOT to do

- Don't add features without asking — this is a focused tool
- Don't create new Telegram messages for UI — always edit the single UI message
- Don't store data without `conversationsCache` — don't read file on every request
- Don't send without `confirm_send` flow — AUTO_SEND must stay false
- Don't add PAGE_ID to env yet — dynamic resolution works fine
