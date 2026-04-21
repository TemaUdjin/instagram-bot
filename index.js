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
const STATE_FILE = path.join(__dirname, 'bot_state.json');

// ─── Bot state ────────────────────────────────────────────────────────────────

const botState = loadBotState();
// Last rendered UI content — used to overlay notifications without changing screen
let currentUIContent = { text: '', keyboard: [] };
// Per-telegram-user session: screen, selectedSenderId, suggestions, pendingReply
const userState = {};

// ─── Persistence ──────────────────────────────────────────────────────────────

function loadBotState() {
  if (fs.existsSync(STATE_FILE)) {
    try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch {}
  }
  return { uiMessageId: null };
}

function saveBotState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify(botState, null, 2));
}

function loadConversations() {
  if (fs.existsSync(LOG_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      // Migrate old flat-array format
      const out = {};
      for (const [id, data] of Object.entries(raw)) {
        if (Array.isArray(data)) {
          out[id] = { profile: { name: '', username: '', status: 'New' }, messages: data };
        } else {
          out[id] = data;
        }
      }
      return out;
    } catch {}
  }
  return {};
}

function saveConversations(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

function appendMessage(senderId, type, text) {
  const data = loadConversations();
  if (!data[senderId]) data[senderId] = { profile: { name: '', username: '', status: 'New' }, messages: [] };
  data[senderId].messages.push({ type, text, time: new Date().toISOString() });
  saveConversations(data);
}

function updateProfile(senderId, name, username) {
  const data = loadConversations();
  if (!data[senderId]) data[senderId] = { profile: { name: '', username: '', status: 'New' }, messages: [] };
  if (name) data[senderId].profile.name = name;
  if (username) data[senderId].profile.username = username;
  saveConversations(data);
}

function setStatus(senderId, status) {
  const data = loadConversations();
  if (!data[senderId]) data[senderId] = { profile: { name: '', username: '', status }, messages: [] };
  else data[senderId].profile.status = status;
  saveConversations(data);
}

function getHistory(senderId, limit = 5) {
  const data = loadConversations();
  const msgs = data[senderId]?.messages || [];
  return msgs.slice(-limit);
}

function getProfile(senderId) {
  const data = loadConversations();
  return data[senderId]?.profile || { name: '', username: '', status: 'New' };
}

function getRecentSenders(limit = 10) {
  const data = loadConversations();
  return Object.entries(data)
    .map(([id, conv]) => ({
      senderId: id,
      profile: conv.profile || { name: '', username: '', status: 'New' },
      lastMessage: (conv.messages || []).slice(-1)[0] || null,
    }))
    .filter(c => c.lastMessage)
    .sort((a, b) => new Date(b.lastMessage.time) - new Date(a.lastMessage.time))
    .slice(0, limit);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function displayName(profile, senderId) {
  return profile.name || profile.username || senderId;
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
    return res.data;
  } catch (err) {
    log('IG user lookup failed', err.response?.data || err.message);
    return null;
  }
}

async function sendInstagramMessage(recipientId, text) {
  const url = `https://graph.instagram.com/v19.0/${BUSINESS_ACCOUNT_ID}/messages`;
  log('IG send →', { recipientId, text });
  try {
    const res = await axios.post(url, { recipient: { id: recipientId }, message: { text } }, {
      params: { access_token: PAGE_ACCESS_TOKEN }
    });
    log('✅ IG sent', res.data);
    return { ok: true, data: res.data };
  } catch (err) {
    const errData = err.response?.data || err.message;
    log('❌ IG send failed', errData);
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

const SYSTEM_PROMPT = `You are a high-level coach in mobility, flexibility, handstand, bodyweight strength, and yoga. You understand joint health and basic rehab. Not a doctor, a practical coach.

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

RULES: Never dump info. If unsure what they need, ask. Respond in the same language the client writes in.`;

async function generateSuggestions(lastMessage, clientName, history) {
  const nameHint = clientName ? `The client's name is ${clientName}. Use their name naturally once if it feels right.` : '';
  const historyText = history.map(m =>
    `${m.type === 'incoming' ? 'Client' : 'Coach'}: ${m.text}`
  ).join('\n');

  const userContent = historyText
    ? `Conversation:\n${historyText}\n\nGenerate exactly 3 short reply options for the last client message.\nFormat:\n1. [reply]\n2. [reply]\n3. [reply]`
    : `Client message: "${lastMessage}"\n\nGenerate exactly 3 short reply options.\nFormat:\n1. [reply]\n2. [reply]\n3. [reply]`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: `${SYSTEM_PROMPT}\n\n${nameHint}`,
    messages: [{ role: 'user', content: userContent }]
  });

  const raw = message.content[0].text.trim();
  return raw.split('\n')
    .filter(l => /^\d\./.test(l.trim()))
    .map(l => removeDashes(l.replace(/^\d\.\s*/, '').trim()))
    .filter(Boolean)
    .slice(0, 3);
}

// ─── Telegram core ────────────────────────────────────────────────────────────

async function sendRawMessage(text) {
  try {
    const res = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID, text,
    });
    return res.data.result;
  } catch (err) {
    console.error('[Telegram send error]', err.response?.data || err.message);
    return null;
  }
}

async function getOrCreateUIMessage() {
  if (botState.uiMessageId) return botState.uiMessageId;
  const result = await sendRawMessage('📥 Loading inbox...');
  if (result) {
    botState.uiMessageId = result.message_id;
    saveBotState();
  }
  return botState.uiMessageId;
}

async function editUIMessage(text, inlineKeyboard = []) {
  if (inlineKeyboard.length === 0) {
    log('⚠️ editUIMessage called with no buttons', { textPreview: text.slice(0, 60) });
  }
  currentUIContent = { text, keyboard: inlineKeyboard };
  const msgId = await getOrCreateUIMessage();
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
      chat_id: CHAT_ID,
      message_id: msgId,
      text,
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  } catch (err) {
    const desc = err.response?.data?.description || '';
    if (desc.includes('message is not modified')) return;
    if (desc.includes('message to edit not found') || desc.includes('MESSAGE_ID_INVALID')) {
      botState.uiMessageId = null;
      saveBotState();
      await getOrCreateUIMessage();
      await editUIMessage(text, inlineKeyboard);
    } else {
      console.error('[editUIMessage error]', desc);
    }
  }
}

async function answerCallbackQuery(id, text = '') {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`, {
      callback_query_id: id, text,
    });
  } catch {}
}

// ─── Screens ──────────────────────────────────────────────────────────────────

async function showInbox(telegramUserId) {
  userState[telegramUserId] = { screen: 'inbox', selectedSenderId: null, suggestions: [], pendingReply: null };

  const senders = getRecentSenders(10);
  let text = '📥 Inbox\n\n';

  if (senders.length === 0) {
    text += 'Inbox is empty.';
  } else {
    for (const s of senders) {
      const name = displayName(s.profile, s.senderId);
      const preview = (s.lastMessage?.text || '').slice(0, 40);
      text += `${name} • ${s.profile.status || 'New'}\n"${preview}"\n\n`;
    }
  }

  const keyboard = senders.map(s => [{
    text: `👤 ${displayName(s.profile, s.senderId)}`,
    callback_data: `dialog_${s.senderId}`,
  }]);

  keyboard.push([{ text: '🔄 Refresh', callback_data: 'inbox' }]);

  await editUIMessage(text.trimEnd(), keyboard);
}

async function showDialog(telegramUserId, senderId) {
  userState[telegramUserId] = { screen: 'dialog', selectedSenderId: senderId, suggestions: [], pendingReply: null };

  // Show loading state immediately
  const profile = getProfile(senderId);
  const history = getHistory(senderId, 5);
  const name = displayName(profile, senderId);
  const usernameStr = profile.username ? ` (@${profile.username})` : '';

  let text = `👤 ${name}${usernameStr}\nStatus: ${profile.status || 'New'}\n\n`;
  for (const m of history) {
    text += `${m.type === 'incoming' ? name : 'You'}: ${m.text}\n`;
  }
  text += '\n💡 Generating suggestions...';

  await editUIMessage(text, [[{ text: '🔙 Back', callback_data: 'inbox' }]]);

  // Generate suggestions async
  try {
    const lastIncoming = [...history].reverse().find(m => m.type === 'incoming');
    const suggestions = await generateSuggestions(
      lastIncoming?.text || '',
      profile.name || profile.username,
      history
    );
    userState[telegramUserId].suggestions = suggestions;
  } catch (err) {
    log('Suggestions error', err.message);
    userState[telegramUserId].suggestions = [];
  }

  await renderDialog(telegramUserId, senderId);
}

async function renderDialog(telegramUserId, senderId) {
  const profile = getProfile(senderId);
  const history = getHistory(senderId, 5);
  const suggestions = userState[telegramUserId]?.suggestions || [];
  const name = displayName(profile, senderId);
  const usernameStr = profile.username ? ` (@${profile.username})` : '';

  let text = `👤 ${name}${usernameStr}\nStatus: ${profile.status || 'New'}\n\n`;
  for (const m of history) {
    text += `${m.type === 'incoming' ? name : 'You'}: ${m.text}\n`;
  }

  if (suggestions.length > 0) {
    text += '\n💡 Suggested replies:\n';
    suggestions.forEach((s, i) => { text += `\n${i + 1}. ${s}`; });
  }

  const keyboard = [];
  suggestions.forEach((_, i) => {
    keyboard.push([
      { text: `Send ${i + 1}`, callback_data: `send_${i}` },
      { text: `Edit ${i + 1}`, callback_data: `edit_${i}` },
    ]);
  });
  keyboard.push([
    { text: '✍️ Custom reply', callback_data: 'custom' },
    { text: '✅ Mark as Client', callback_data: 'mark_client' },
  ]);
  keyboard.push([
    { text: '🔁 Follow-up later', callback_data: 'followup' },
    { text: '🔙 Back', callback_data: 'inbox' },
  ]);

  await editUIMessage(text, keyboard);
}

async function showConfirm(telegramUserId, replyText) {
  const state = userState[telegramUserId];
  const profile = getProfile(state.selectedSenderId);
  const name = displayName(profile, state.selectedSenderId);
  const usernameStr = profile.username ? ` (@${profile.username})` : '';

  state.pendingReply = replyText;
  state.screen = 'confirm';

  const text = `Sending to: ${name}${usernameStr}\n\n"${replyText}"`;
  await editUIMessage(text, [[
    { text: '✅ Confirm Send', callback_data: 'confirm_send' },
    { text: '❌ Cancel', callback_data: `dialog_${state.selectedSenderId}` },
  ]]);
}

async function showCustomReply(telegramUserId, prefillText = null) {
  const state = userState[telegramUserId];
  state.screen = 'custom_reply';

  let text = '✍️ Type your reply and send it here.';
  if (prefillText) text += `\n\nSuggestion for reference:\n"${prefillText}"`;

  await editUIMessage(text, [[
    { text: '❌ Cancel', callback_data: `dialog_${state.selectedSenderId}` },
  ]]);
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

  res.status(tokenCheck.valid && claudeOk && telegramOk ? 200 : 503).json(status);
});

app.get('/debug-token', async (req, res) => {
  const token = PAGE_ACCESS_TOKEN || '';
  const tokenType = token.startsWith('IGAA') ? 'IGAA (Instagram long-lived — correct)' :
                    token.startsWith('EAAX') ? 'EAAXfm (Facebook user — wrong type)' :
                    token ? 'unknown type' : 'missing';
  const validity = await checkTokenValidity();
  const permissions = await checkTokenPermissions();
  res.json({
    token_preview: { starts_with: token.slice(0, 15), ends_with: token.slice(-10), length: token.length, type: tokenType },
    valid: validity.valid,
    account: validity.account || null,
    error: validity.error || null,
    permissions: permissions.filter(p => p.status === 'granted').map(p => p.permission),
    missing_permissions: permissions.filter(p => p.status !== 'granted').map(p => p.permission),
  });
});

app.get('/test-claude', async (req, res) => {
  try {
    const suggestions = await generateSuggestions('How much is a session?', null, []);
    res.json({ ok: true, suggestions });
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
      const recipientId = event.recipient.id;
      const text = event.message.text || '(no text)';
      log('Incoming DM', { senderId, recipientId, text });

      if (senderId === PAGE_ID || senderId === BUSINESS_ACCOUNT_ID) {
        log('Ignored self message', { senderId, text });
        continue;
      }

      appendMessage(senderId, 'incoming', text);

      const user = await getInstagramUser(senderId);
      if (user) updateProfile(senderId, user.name, user.username);

      const profile = getProfile(senderId);
      const name = displayName(profile, senderId);

      // Overlay notification on current screen without interrupting it
      const notif = `🔔 New message from ${name}`;
      const msgId = await getOrCreateUIMessage();
      if (msgId && currentUIContent.text) {
        try {
          await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
            chat_id: CHAT_ID,
            message_id: msgId,
            text: `${notif}\n\n${currentUIContent.text}`,
            reply_markup: { inline_keyboard: currentUIContent.keyboard },
          });
        } catch {}
      }
    }
  }
});

// ─── Routes: Telegram ────────────────────────────────────────────────────────

app.post('/telegram', async (req, res) => {
  res.sendStatus(200);
  const body = req.body;

  const telegramUserId = String(
    body.callback_query?.from?.id || body.message?.from?.id || ''
  );
  if (!telegramUserId) return;

  if (!userState[telegramUserId]) {
    userState[telegramUserId] = { screen: 'inbox', selectedSenderId: null, suggestions: [], pendingReply: null };
  }

  // ── Button click ──────────────────────────────────────────────────────────
  if (body.callback_query) {
    const query = body.callback_query;
    const data = query.data;
    await answerCallbackQuery(query.id);

    if (data === 'inbox') {
      await showInbox(telegramUserId);

    } else if (data.startsWith('dialog_')) {
      const senderId = data.slice('dialog_'.length);
      log('Dialog opened', { telegramUserId, senderId });
      await showDialog(telegramUserId, senderId);

    } else if (data.startsWith('send_')) {
      const idx = parseInt(data.slice('send_'.length));
      const suggestion = userState[telegramUserId].suggestions[idx];
      if (suggestion) await showConfirm(telegramUserId, suggestion);

    } else if (data.startsWith('edit_')) {
      const idx = parseInt(data.slice('edit_'.length));
      const suggestion = userState[telegramUserId].suggestions[idx];
      await showCustomReply(telegramUserId, suggestion || null);

    } else if (data === 'custom') {
      await showCustomReply(telegramUserId);

    } else if (data === 'mark_client') {
      const { selectedSenderId } = userState[telegramUserId];
      if (selectedSenderId) {
        setStatus(selectedSenderId, 'Client');
        log('Marked as Client', { selectedSenderId });
      }
      await renderDialog(telegramUserId, selectedSenderId);

    } else if (data === 'followup') {
      // Follow-up: no status change, just re-render dialog
      const { selectedSenderId } = userState[telegramUserId];
      await renderDialog(telegramUserId, selectedSenderId);

    } else if (data === 'confirm_send') {
      const { selectedSenderId, pendingReply } = userState[telegramUserId];
      log('Sending message', { selectedSenderId, pendingReply });

      const result = await sendInstagramMessage(selectedSenderId, pendingReply);
      if (result.ok) {
        appendMessage(selectedSenderId, 'outgoing', pendingReply);
        setStatus(selectedSenderId, 'Replied');
        userState[telegramUserId].pendingReply = null;
        log('Message sent', { selectedSenderId, pendingReply });
        await showDialog(telegramUserId, selectedSenderId);
      } else {
        log('Send failed', result.error);
        await editUIMessage(
          `❌ Failed to send:\n${JSON.stringify(result.error, null, 2)}`,
          [[{ text: '🔙 Back', callback_data: `dialog_${selectedSenderId}` }]]
        );
      }
    }
    return;
  }

  // ── Text message ──────────────────────────────────────────────────────────
  const message = body.message;
  if (!message || !message.text) return;

  const state = userState[telegramUserId];
  const text = message.text.trim();

  if (state.screen === 'custom_reply' && state.selectedSenderId) {
    await showConfirm(telegramUserId, text);
  } else {
    await showInbox(telegramUserId);
  }
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
  await showInbox(CHAT_ID);
});
