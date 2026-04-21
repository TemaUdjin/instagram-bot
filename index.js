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
const STYLE_FILE = path.join(__dirname, 'style_profile.json');

// No message is ever sent without explicit user confirmation.
// Style learning only happens from manually approved messages.
const AUTO_SEND = false;

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

// In-memory store — primary source of truth; file is backup for cold start
let conversationsCache = null;

// Pending notification queue — new messages from users not currently open
const pendingNotifications = []; // [{ senderId, name, username }]

function addNotification(senderId, name, username) {
  if (!pendingNotifications.find(n => n.senderId === senderId)) {
    pendingNotifications.push({ senderId, name, username });
    log('Notification queued', { senderId, name, total: pendingNotifications.length });
  }
}

function removeNotification(senderId) {
  const idx = pendingNotifications.findIndex(n => n.senderId === senderId);
  if (idx !== -1) pendingNotifications.splice(idx, 1);
}

function applyNotifications(text, keyboard) {
  if (pendingNotifications.length === 0) return { finalText: text, finalKeyboard: keyboard };

  const notifRows = pendingNotifications.slice(0, 3).map(n => {
    const label = (n.name || n.username || n.senderId).slice(0, 20);
    const usernameStr = n.username ? ` (@${n.username})` : '';
    return [
      { text: `📨 ${label}${usernameStr}`, callback_data: `open_notif_${n.senderId}` },
      { text: '✖️', callback_data: `ignore_notif_${n.senderId}` },
    ];
  });

  const banner = pendingNotifications.length === 1
    ? `🔔 New message from ${pendingNotifications[0].name || pendingNotifications[0].senderId}`
    : `📥 ${pendingNotifications.length} new messages`;

  return {
    finalText: `${banner}\n\n${text}`,
    finalKeyboard: [...notifRows, ...keyboard],
  };
}

function loadConversations() {
  if (conversationsCache !== null) return conversationsCache;
  if (fs.existsSync(LOG_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
      const out = {};
      for (const [id, data] of Object.entries(raw)) {
        if (Array.isArray(data)) {
          out[id] = { profile: { name: '', username: '', status: 'New' }, messages: data };
        } else {
          out[id] = data;
        }
      }
      conversationsCache = out;
      log('Conversations loaded from file', { total: Object.keys(out).length });
      return conversationsCache;
    } catch (err) {
      log('Failed to load conversations file', err.message);
    }
  }
  conversationsCache = {};
  return conversationsCache;
}

function saveConversations(data) {
  conversationsCache = data;
  try {
    fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    log('Failed to write conversations file', err.message);
  }
}

function appendMessage(senderId, type, text) {
  const data = loadConversations();
  if (!data[senderId]) {
    data[senderId] = { profile: { name: '', username: '', status: 'New' }, messages: [] };
    log('New conversation created', { senderId });
  }
  data[senderId].messages.push({ type, text, time: new Date().toISOString() });
  saveConversations(data);
  log(`Message stored from ${senderId}`, { type, text: text.slice(0, 60) });
  log('Total conversations', Object.keys(data).length);
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
    .filter(c => c.lastMessage && c.profile.status !== 'Ignored')
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

// ─── Style profile ────────────────────────────────────────────────────────────

let styleCache = null;

function loadStyleProfile() {
  if (styleCache !== null) return styleCache;
  if (fs.existsSync(STYLE_FILE)) {
    try {
      styleCache = JSON.parse(fs.readFileSync(STYLE_FILE, 'utf8'));
      return styleCache;
    } catch {}
  }
  styleCache = { examples: [] };
  return styleCache;
}

function saveStyleExample(text) {
  const profile = loadStyleProfile();
  profile.examples.push({ text, time: new Date().toISOString() });
  if (profile.examples.length > 50) profile.examples = profile.examples.slice(-50);
  styleCache = profile;
  try { fs.writeFileSync(STYLE_FILE, JSON.stringify(profile, null, 2)); } catch (err) {
    log('Failed to save style example', err.message);
  }
  log('Style example saved', { text: text.slice(0, 60), total: profile.examples.length });
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

function analyzeStyle(examples) {
  if (examples.length === 0) return null;
  const wordCounts = examples.map(e => e.text.trim().split(/\s+/).length);
  const avgWords = Math.round(wordCounts.reduce((a, b) => a + b, 0) / wordCounts.length);
  const maxWords = Math.max(...wordCounts);
  const questionRate = Math.round(examples.filter(e => e.text.includes('?')).length / examples.length * 100);
  const shortRate = Math.round(examples.filter(e => e.text.split(/\s+/).length <= 12).length / examples.length * 100);
  const lengthLabel = avgWords <= 8 ? 'VERY SHORT (under 10 words)' : avgWords <= 15 ? 'SHORT (10–15 words)' : avgWords <= 25 ? 'MEDIUM (15–25 words)' : 'LONGER';
  return { avgWords, maxWords, questionRate, shortRate, lengthLabel };
}

function computeStyleMatch(suggestions, stats) {
  if (!stats) return null;
  const avgGenWords = suggestions.reduce((s, r) => s + r.split(/\s+/).length, 0) / suggestions.length;
  const diff = Math.abs(avgGenWords - stats.avgWords) / Math.max(stats.avgWords, 1);
  return Math.round(Math.max(0, 1 - diff) * 100);
}

function parseSuggestions(raw) {
  return raw.split('\n')
    .filter(l => /^\d\./.test(l.trim()))
    .map(l => removeDashes(l.replace(/^\d\.\s*/, '').trim()))
    .filter(Boolean)
    .slice(0, 3);
}

async function generateSuggestions(lastMessage, clientName, history, attempt = 0) {
  const nameHint = clientName ? `Client name: ${clientName}. Use naturally once if it fits.` : '';

  const allExamples = loadStyleProfile().examples;
  const recent = allExamples.slice(-20);
  const stats = analyzeStyle(recent);

  log('STYLE SOURCE', { messages: recent.length, stats });

  // Build style data block — this is the highest-priority input for Claude
  let styleBlock = '';
  if (recent.length >= 3 && stats) {
    const samples = recent.slice(-10).map((e, i) => `${i + 1}. "${e.text}"`).join('\n');
    styleBlock = `
══════════════════════════════════════
REAL USER MESSAGES — PRIMARY STYLE SOURCE (${recent.length} total, recent = highest priority):
${samples}

EXTRACTED STYLE RULES (enforce strictly):
- Target length: ${stats.lengthLabel} — average ${stats.avgWords} words, max seen ${stats.maxWords}
- Questions: used in ${stats.questionRate}% of messages${stats.questionRate > 50 ? ' — include a question' : ' — avoid forced questions'}
- Short replies: ${stats.shortRate}% of messages are ≤12 words${stats.shortRate > 60 ? ' — keep it short' : ''}
- DO NOT exceed ${Math.round(stats.avgWords * 1.4)} words per reply
- Match vocabulary and phrasing from the examples above
══════════════════════════════════════`;
  } else {
    styleBlock = `\n(No style data yet — use default coaching tone)`;
  }

  const historyText = history.map(m =>
    `${m.type === 'incoming' ? 'Client' : 'Coach'}: ${m.text}`
  ).join('\n');

  const convContext = historyText
    ? `Conversation:\n${historyText}`
    : `Client message: "${lastMessage}"`;

  const system = `${SYSTEM_PROMPT}
${nameHint}
${styleBlock}

CONVERSATION FLOW (natural progression, never rush):
1. Connect — acknowledge, reflect their situation briefly
2. Understand — ask 1 focused question
3. Guide — direction when you have enough context
4. Offer (only when warm/ready) — "I work 1:1 with people on this, adjusting to their level." Then stop.
5. If hesitating — after time: "I'm also putting together a video program. Can add you to the waitlist if you want."

Intent signals: curious / warm / ready / cold
Stage signals: new / exploring / considering / decision

VIDEO (only if natural): "You can send me a short video if you want, I'll take a look."

Generate exactly 3 reply options. Each must match the style rules above.
Format:
1. [reply]
2. [reply]
3. [reply]`;

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: `${convContext}\n\nGenerate 3 reply options for the last client message.` }]
  });

  const suggestions = parseSuggestions(message.content[0].text.trim());

  const match = computeStyleMatch(suggestions, stats);
  if (match !== null) {
    log('STYLE MATCH', `${match}%`);
    // Retry once if match is very low and we have enough style data
    if (match < 50 && attempt === 0 && recent.length >= 5) {
      log('Style match low — retrying', { match, attempt });
      return generateSuggestions(lastMessage, clientName, history, 1);
    }
  }

  return suggestions;
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

async function pushEdit(text, inlineKeyboard) {
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
      await pushEdit(text, inlineKeyboard);
    } else {
      console.error('[editUIMessage error]', desc);
    }
  }
}

async function editUIMessage(text, inlineKeyboard = []) {
  // Store raw content so notifications can be reapplied correctly
  currentUIContent = { text, keyboard: inlineKeyboard };
  const { finalText, finalKeyboard } = applyNotifications(text, inlineKeyboard);
  await pushEdit(finalText, finalKeyboard);
}

// Called from webhook to overlay notification without changing current screen
async function refreshUIWithNotifications() {
  const { finalText, finalKeyboard } = applyNotifications(currentUIContent.text, currentUIContent.keyboard);
  const msgId = await getOrCreateUIMessage();
  if (!msgId) return;
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
      chat_id: CHAT_ID,
      message_id: msgId,
      text: finalText,
      reply_markup: { inline_keyboard: finalKeyboard },
    });
  } catch (err) {
    const desc = err.response?.data?.description || '';
    if (!desc.includes('message is not modified')) console.error('[refreshUI error]', desc);
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

  // Only generate suggestions when last message is from client
  const lastMessage = history[history.length - 1];
  const shouldSuggest = lastMessage && lastMessage.type === 'incoming';

  if (shouldSuggest) {
    try {
      const suggestions = await generateSuggestions(
        lastMessage.text,
        profile.name || profile.username,
        history
      );
      userState[telegramUserId].suggestions = suggestions;
      log('Suggestions generated', { senderId, count: suggestions.length });
    } catch (err) {
      log('Suggestions error', err.message);
      userState[telegramUserId].suggestions = [];
    }
  } else {
    userState[telegramUserId].suggestions = [];
    log('No suggestions — last message is outgoing', { senderId });
  }

  await renderDialog(telegramUserId, senderId);
}

async function renderDialog(telegramUserId, senderId) {
  const profile = getProfile(senderId);
  const history = getHistory(senderId, 5);
  const suggestions = userState[telegramUserId]?.suggestions || [];
  const name = displayName(profile, senderId);
  const usernameStr = profile.username ? ` (@${profile.username})` : '';

  // Header with profile info
  let text = `👤 ${name}${usernameStr}\n`;
  if (profile.username) text += `instagram.com/${profile.username}\n`;
  text += `Status: ${profile.status || 'New'}\n\n`;

  // Message history
  for (const m of history) {
    text += `${m.type === 'incoming' ? name : 'You'}: ${m.text}\n`;
  }

  // Suggestions (only when last message is from client)
  const lastMessage = history[history.length - 1];
  const lastIncoming = lastMessage?.type === 'incoming' ? lastMessage : null;

  if (suggestions.length > 0 && lastIncoming) {
    text += `\nReplying to:\n"${lastIncoming.text}"\n`;
    text += '\n💡 Suggested replies:\n';
    suggestions.forEach((s, i) => { text += `\n${i + 1}. ${s}`; });
  }

  const keyboard = [];
  if (suggestions.length > 0 && lastIncoming) {
    suggestions.forEach((_, i) => {
      keyboard.push([
        { text: `Send ${i + 1}`, callback_data: `send_${i}` },
        { text: `Edit ${i + 1}`, callback_data: `edit_${i}` },
      ]);
    });
  }
  keyboard.push([
    { text: '✍️ Custom reply', callback_data: 'custom' },
    { text: '✅ Mark as Client', callback_data: 'mark_client' },
  ]);
  keyboard.push([{ text: '🚫 Ignore conversation', callback_data: 'ignore_conv' }]);
  const lastRow = [{ text: '🔁 Follow-up later', callback_data: 'followup' }, { text: '🔙 Back', callback_data: 'inbox' }];
  if (profile.username) {
    keyboard.push([{ text: '🔗 Open Instagram', url: `https://instagram.com/${profile.username}` }]);
  }
  keyboard.push(lastRow);

  await editUIMessage(text, keyboard);
}

async function showConfirm(telegramUserId, replyText) {
  const state = userState[telegramUserId];
  const profile = getProfile(state.selectedSenderId);
  const name = displayName(profile, state.selectedSenderId);
  const usernameStr = profile.username ? ` (@${profile.username})` : '';

  state.pendingReply = replyText;
  state.screen = 'confirm';

  // AUTO_SEND is false — confirmation is always required
  if (AUTO_SEND) throw new Error('AUTO_SEND must remain false');

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
      if (!event.message) continue;

      const senderId = String(event.sender.id);
      const recipientId = String(event.recipient.id);
      const text = event.message.text || '(no text)';
      const isEcho = !!event.message.is_echo;

      // Detect self-messages: is_echo flag OR sender is our business account
      const selfIds = [BUSINESS_ACCOUNT_ID, PAGE_ID].filter(Boolean).map(String);
      const isSelf = isEcho || selfIds.includes(senderId);

      log('Webhook event', { senderId, recipientId, isEcho, isSelf, text: text.slice(0, 60) });

      if (isSelf) {
        // Outgoing message echoed back — store under the CLIENT's thread (recipientId), not our own
        if (selfIds.includes(recipientId)) {
          log('Ignored self-to-self message', { senderId, recipientId });
        } else {
          log('Echo: storing outgoing in client thread', { clientId: recipientId, text: text.slice(0, 60) });
          appendMessage(recipientId, 'outgoing', text);
        }
        continue;
      }

      // clientId is always the person writing TO us
      const clientId = senderId;

      // Detect media attachments
      const attachments = event.message.attachments || [];
      const hasVideo = attachments.some(a => ['video', 'ig_reel'].includes(a.type));
      const hasImage = attachments.some(a => a.type === 'image');
      const messageText = text !== '(no text)'
        ? text
        : hasVideo ? '[📹 Video]' : hasImage ? '[🖼️ Image]' : '[attachment]';

      appendMessage(clientId, 'incoming', messageText);

      // If previously ignored, restore to inbox
      const existingProfile = getProfile(clientId);
      if (existingProfile.status === 'Ignored') {
        setStatus(clientId, 'New');
        log('Ignored conversation restored to inbox', { clientId });
      }

      const user = await getInstagramUser(clientId);
      if (user) updateProfile(clientId, user.name, user.username);

      const profile = getProfile(clientId);
      const name = displayName(profile, clientId);

      // For video: add special alert label to notification
      const notifLabel = hasVideo
        ? `${name} sent a 📹 video — reply manually`
        : name;

      // Check if this sender's dialog is currently open
      const openDialogUsers = Object.entries(userState)
        .filter(([, s]) => s.screen === 'dialog' && s.selectedSenderId === clientId)
        .map(([tgId]) => tgId);

      const currentProfile = getProfile(clientId);
      if (currentProfile.status === 'Ignored') {
        log('Skipping notification for ignored conversation', { clientId });
      } else if (openDialogUsers.length > 0) {
        // Refresh the open dialog so new message appears in history
        for (const tgId of openDialogUsers) {
          await showDialog(tgId, clientId);
        }
      } else {
        // Queue notification and overlay on current screen
        addNotification(clientId, notifLabel, profile.username);
        await refreshUIWithNotifications();
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

    } else if (data.startsWith('open_notif_')) {
      const notifSenderId = data.slice('open_notif_'.length);
      removeNotification(notifSenderId);
      log('Notification opened', { notifSenderId });
      await showDialog(telegramUserId, notifSenderId);

    } else if (data.startsWith('ignore_notif_')) {
      const notifSenderId = data.slice('ignore_notif_'.length);
      removeNotification(notifSenderId);
      log('Notification ignored', { notifSenderId });
      // Re-render current screen — notifications updated, screen unchanged
      await editUIMessage(currentUIContent.text, currentUIContent.keyboard);

    } else if (data === 'mark_client') {
      const { selectedSenderId } = userState[telegramUserId];
      if (selectedSenderId) {
        setStatus(selectedSenderId, 'Client');
        log('Marked as Client', { selectedSenderId });
      }
      await renderDialog(telegramUserId, selectedSenderId);

    } else if (data === 'ignore_conv') {
      const { selectedSenderId } = userState[telegramUserId];
      if (selectedSenderId) {
        setStatus(selectedSenderId, 'Ignored');
        removeNotification(selectedSenderId);
        log('Conversation ignored', { selectedSenderId });
      }
      await editUIMessage('Conversation ignored ✅', [[{ text: '🔙 Back to Inbox', callback_data: 'inbox' }]]);

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
        saveStyleExample(pendingReply);
        userState[telegramUserId].pendingReply = null;
        userState[telegramUserId].suggestions = [];
        log('Message sent', { selectedSenderId, pendingReply });
        await renderDialog(telegramUserId, selectedSenderId);
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

function cleanSelfConversations() {
  const data = loadConversations();
  const selfIds = [BUSINESS_ACCOUNT_ID, PAGE_ID].filter(Boolean).map(String);
  let cleaned = 0;
  for (const id of selfIds) {
    if (data[id]) {
      delete data[id];
      cleaned++;
    }
  }
  if (cleaned > 0) {
    saveConversations(data);
    log('Cleaned self-conversations', { removed: cleaned, selfIds });
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  log('Server started', { port: PORT });
  log('Config', {
    BUSINESS_ACCOUNT_ID,
    PAGE_ID: PAGE_ID || '(not set)',
    token_type: PAGE_ACCESS_TOKEN?.startsWith('IGAA') ? 'IGAA ✅' : 'wrong type ❌',
    token_preview: PAGE_ACCESS_TOKEN?.slice(0, 15) + '...',
  });
  cleanSelfConversations();
  await showInbox(CHAT_ID);
});
