const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ACCOUNT_ID;
const PAGE_ID = process.env.PAGE_ID;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LOG_FILE = path.join(__dirname, 'conversations.json');

const pendingReplies = {};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadConversations() {
  if (fs.existsSync(LOG_FILE)) {
    try { return JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch {}
  }
  return {};
}

function appendMessage(senderId, type, text) {
  const data = loadConversations();
  if (!data[senderId]) data[senderId] = [];
  data[senderId].push({ type, text, time: new Date().toISOString() });
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

function getHistory(senderId, limit = 5) {
  const data = loadConversations();
  const msgs = data[senderId] || [];
  return msgs.slice(-limit);
}

function formatHistory(history) {
  if (history.length === 0) return '(no previous messages)';
  return history.map(m => {
    const arrow = m.type === 'incoming' ? '👤' : '🤖';
    return `${arrow} ${m.text}`;
  }).join('\n');
}

function removeDashes(text) {
  return text
    .replace(/\s*—\s*/g, '. ')
    .replace(/\s*–\s*/g, '. ')
    .replace(/\s+-\s+/g, '. ')
    .replace(/\.\s*\.\s*/g, '. ')
    .trim();
}

function log(label, data) {
  const ts = new Date().toISOString();
  if (typeof data === 'object') {
    console.log(`[${ts}] ${label}:`, JSON.stringify(data));
  } else {
    console.log(`[${ts}] ${label}:`, data);
  }
}

// ─── Instagram ────────────────────────────────────────────────────────────────

async function getInstagramUser(userId) {
  try {
    const res = await axios.get(`https://graph.instagram.com/v19.0/${userId}`, {
      params: { fields: 'name,username', access_token: PAGE_ACCESS_TOKEN }
    });
    log('IG user lookup', res.data);
    return res.data;
  } catch (err) {
    log('IG user lookup failed', err.response?.data || err.message);
    return null;
  }
}

async function sendInstagramMessage(recipientId, text) {
  const url = `https://graph.instagram.com/v19.0/${BUSINESS_ACCOUNT_ID}/messages`;
  const payload = { recipient: { id: recipientId }, message: { text } };
  log('IG send →', { url, recipientId, text });
  try {
    const res = await axios.post(url, payload, {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });
    log('✅ IG sent', res.data);
    return { ok: true, data: res.data };
  } catch (err) {
    const errData = err.response?.data || err.message;
    log('❌ IG send failed', errData);
    await sendTelegramMessage(
      `❌ Instagram send failed\nRecipient: ${recipientId}\nError: ${JSON.stringify(errData, null, 2)}`
    );
    return { ok: false, error: errData };
  }
}

async function checkTokenValidity() {
  try {
    const res = await axios.get('https://graph.instagram.com/v19.0/me', {
      params: { fields: 'id,username,name', access_token: PAGE_ACCESS_TOKEN }
    });
    const tokenType = PAGE_ACCESS_TOKEN?.startsWith('IGAA') ? 'IGAA (Instagram long-lived)' :
                      PAGE_ACCESS_TOKEN?.startsWith('EAAX') ? 'EAAXfm (Facebook user)' : 'unknown';
    return { valid: true, account: res.data, token_type: tokenType };
  } catch (err) {
    return { valid: false, error: err.response?.data || err.message };
  }
}

async function checkTokenPermissions() {
  try {
    const res = await axios.get('https://graph.facebook.com/v18.0/me/permissions', {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });
    return res.data.data || [];
  } catch {
    return [];
  }
}

// ─── Claude ───────────────────────────────────────────────────────────────────

async function generateReply(incomingText, clientName) {
  const nameHint = clientName ? `The client's name is ${clientName}. Use their name naturally once if it feels right.` : '';
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: `You are a high-level coach in mobility, flexibility, handstand, bodyweight strength, and yoga. You understand joint health and basic rehab. Not a doctor, a practical coach.

TRAINING: Sessions combine yoga, mobility work and bodyweight training. Shoulders, spine, hips, full body control. 1h to 1h40min. Any level.

PRICING: 1 session = 70 euro or ~80 USD. Payment by crypto (preferred) or Wise.

BOOKING: Ask for time zone, preferred days and time. Then offer slots.

STYLE RULES (FOLLOW STRICTLY):
Write short. 1 to 3 sentences only.
Sound human, calm, confident, slightly informal.
Write like a real coach texting someone, not a marketer.
No pressure. No sales language. No long explanations.
No formal greetings like "Hello" or "Hi there".
No bullet points or lists.
No corporate phrases.
NEVER use dashes of any kind. No em dash. No en dash. No hyphen between words. Rewrite the sentence without them.
If you want to connect two thoughts, use a period or a new sentence instead.

CONVERSATION GOAL: Understand the person first. Ask one question at a time. Move naturally toward booking.

WHEN PRICE IS ASKED: "One session is 70 euro, adjusted to your level and goals." Then ask what they are working on.

FOLLOW UP if hesitating: "I am also putting together an online program, more affordable and self paced. Can let you know when it drops." No pressure.

RULES: Never dump info. If unsure what they need, ask. Respond in the same language the client writes in.

${nameHint}`,
    messages: [{ role: 'user', content: incomingText }]
  });
  return removeDashes(message.content[0].text.trim());
}

// ─── Telegram ─────────────────────────────────────────────────────────────────

async function sendTelegramMessage(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text
    });
  } catch (error) {
    console.error('[Telegram send error]', error.response?.data || error.message);
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function buildClientCard(user, senderId) {
  if (!user || (!user.name && !user.username)) {
    return `User ID: ${senderId}`;
  }
  const name = user.name || user.username;
  const username = user.username;
  if (username) {
    return `Name: ${name}\nUsername: @${username}\nProfile: https://instagram.com/${username}\nUser ID: ${senderId}`;
  }
  return `Name: ${name}\nUser ID: ${senderId}`;
}

// ─── Routes: diagnostics ──────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
  const tokenCheck = await checkTokenValidity();

  let claudeOk = false;
  try {
    await anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 10,
      messages: [{ role: 'user', content: 'ping' }]
    });
    claudeOk = true;
  } catch {}

  let telegramOk = false;
  try {
    const r = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getMe`);
    telegramOk = !!r.data.ok;
  } catch {}

  const status = {
    token: tokenCheck,
    instagram_account_id: BUSINESS_ACCOUNT_ID,
    claude: claudeOk,
    telegram: telegramOk,
    env: {
      PAGE_ACCESS_TOKEN: !!PAGE_ACCESS_TOKEN,
      BUSINESS_ACCOUNT_ID: !!BUSINESS_ACCOUNT_ID,
      VERIFY_TOKEN: !!VERIFY_TOKEN,
      TELEGRAM_TOKEN: !!TELEGRAM_TOKEN,
      CHAT_ID: !!CHAT_ID,
      ANTHROPIC_API_KEY: !!process.env.ANTHROPIC_API_KEY,
    }
  };

  const allOk = tokenCheck.valid && claudeOk && telegramOk;
  res.status(allOk ? 200 : 503).json(status);
});

app.get('/debug-token', async (req, res) => {
  const token = PAGE_ACCESS_TOKEN || '';
  const tokenType = token.startsWith('IGAA') ? 'IGAA (Instagram long-lived — correct)' :
                    token.startsWith('EAAX') ? 'EAAXfm (Facebook user — wrong type)' :
                    token ? 'unknown type' : 'missing';

  const validity = await checkTokenValidity();
  const permissions = await checkTokenPermissions();

  res.json({
    token_preview: {
      starts_with: token.slice(0, 15),
      ends_with: token.slice(-10),
      length: token.length,
      type: tokenType,
    },
    valid: validity.valid,
    account: validity.account || null,
    error: validity.error || null,
    permissions: permissions.filter(p => p.status === 'granted').map(p => p.permission),
    missing_permissions: permissions.filter(p => p.status !== 'granted').map(p => p.permission),
  });
});

app.get('/test-claude', async (req, res) => {
  try {
    const result = await generateReply('How much is a session?', null);
    res.json({ ok: true, reply: result });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.get('/test-telegram', async (req, res) => {
  try {
    const result = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID, text: '✅ Railway → Telegram test OK'
    });
    res.json({ ok: true, telegram: result.data });
  } catch (err) {
    res.json({ ok: false, error: err.response?.data || err.message });
  }
});

app.get('/test-user/:userId', async (req, res) => {
  const user = await getInstagramUser(req.params.userId);
  res.json({ user });
});

// ─── Routes: webhook ─────────────────────────────────────────────────────────

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    log('Webhook verified', { mode, token });
    res.status(200).send(challenge);
  } else {
    log('Webhook verify FAILED', { mode, token });
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  log('Webhook received', body);

  if (body.object !== 'instagram') return;

  for (const entry of body.entry) {
    const messaging = entry.messaging;
    if (!messaging) continue;

    for (const event of messaging) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const text = event.message.text || '(no text)';
      log('Incoming DM', { senderId, text, entryId: entry.id });

      appendMessage(senderId, 'incoming', text);

      const user = await getInstagramUser(senderId);
      const clientCard = buildClientCard(user, senderId);
      const clientName = user?.name || user?.username || null;
      const history = getHistory(senderId, 5);

      await sendTelegramMessage(
        `New Instagram DM:\n\n${clientCard}\n\nHistory:\n${formatHistory(history)}\n\nMessage:\n"${text}"\n\n⏳ Generating reply...`
      );

      try {
        const suggested = await generateReply(text, clientName);
        const key = Date.now().toString();
        pendingReplies[key] = { instagramUserId: senderId, suggestedReply: suggested, clientMessage: text };

        await sendTelegramMessage(
          `🤖 Suggested reply:\n"${suggested}"\n\nSend your own text to reply.\nSend "+" to accept.`
        );
      } catch (err) {
        log('Claude error', err.message);
        const key = Date.now().toString();
        pendingReplies[key] = { instagramUserId: senderId, suggestedReply: null, clientMessage: text };
        await sendTelegramMessage(`⚠️ Claude unavailable. Reply manually with your text.`);
      }
    }
  }
});

// ─── Routes: Telegram replies ─────────────────────────────────────────────────

app.post('/telegram', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.text) return res.sendStatus(200);

  const text = message.text.trim();
  const keys = Object.keys(pendingReplies);

  if (keys.length === 0) {
    await sendTelegramMessage('⚠️ No pending Instagram messages to reply to.');
    return res.sendStatus(200);
  }

  const lastKey = keys[keys.length - 1];
  const { instagramUserId, suggestedReply, clientMessage } = pendingReplies[lastKey];
  delete pendingReplies[lastKey];

  const finalReply = text === '+' ? suggestedReply : text;

  if (!finalReply) {
    await sendTelegramMessage('⚠️ No suggested reply available. Send the text you want to send.');
    pendingReplies[lastKey] = { instagramUserId, suggestedReply, clientMessage };
    return res.sendStatus(200);
  }

  const result = await sendInstagramMessage(instagramUserId, finalReply);
  if (result.ok) {
    appendMessage(instagramUserId, 'outgoing', finalReply);
    await sendTelegramMessage(`✅ Sent to Instagram:\n"${finalReply}"`);
  }

  res.sendStatus(200);
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  log('Server started', { port: PORT });
  log('Config', {
    BUSINESS_ACCOUNT_ID,
    PAGE_ID,
    token_type: PAGE_ACCESS_TOKEN?.startsWith('IGAA') ? 'IGAA ✅' : 'wrong type ❌',
    token_preview: PAGE_ACCESS_TOKEN?.slice(0, 15) + '...',
  });
  await sendTelegramMessage('Bot is live 🚀');
});
