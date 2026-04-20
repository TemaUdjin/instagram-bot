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

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const LOG_FILE = path.join(__dirname, 'conversations.json');

// key -> { instagramUserId, suggestedReply, clientMessage, clientName }
const pendingReplies = {};

function saveConversation(clientMessage, finalReply) {
  let log = [];
  if (fs.existsSync(LOG_FILE)) {
    try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch {}
  }
  log.push({ date: new Date().toISOString(), client: clientMessage, reply: finalReply });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

async function getInstagramUser(userId) {
  try {
    const res = await axios.get(`https://graph.instagram.com/v19.0/${userId}`, {
      params: { fields: 'name,username', access_token: PAGE_ACCESS_TOKEN }
    });
    return res.data;
  } catch {
    return null;
  }
}

async function generateReply(incomingText, clientName) {
  const nameHint = clientName ? `The client's name is ${clientName}. Use their name naturally if it fits.` : '';
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: `You are a high-level coach in mobility, flexibility, handstand, bodyweight strength, and yoga. You understand joint health, shoulder/elbow/knee pain, and basic rehab. You are NOT a doctor.

TRAINING:
Sessions combine yoga, mobility work, and bodyweight training. Focus on shoulders, spine, hips, full body control. Duration 1h to 1h40min. Works for any level.

PRICING:
1 session = 70 euro (or ~80 USD). Payment by crypto (preferred) or Wise.

BOOKING: collect time zone, preferred days and time, then offer slots.

STYLE (CRITICAL):
Short. 1 to 3 sentences max. Human, calm, confident, slightly informal. Like a real coach talking to someone, not a marketer writing copy. No pressure, no sales language, no long explanations. No formal greetings. No lists. No corporate phrases. Never use dashes or hyphens in your sentences.

GOAL:
Understand the person first. Ask one question at a time. Guide naturally toward booking. Build trust, show understanding.

WHEN PRICE IS ASKED:
"One session is 70 euro, everything is adjusted to your level and goals." Then ask what they are working on.

FOLLOW UP if hesitating:
"I am also putting together an online program, more affordable and self paced. Can let you know when it drops." No pressure.

RULES:
Never dump info. If unsure what they need, ask. Keep it short. Respond in the same language the client writes in. Never use dashes or hyphens anywhere in the reply.

${nameHint}`,
    messages: [{ role: 'user', content: incomingText }]
  });
  return message.content[0].text.trim().replace(/[—–-]/g, '');
}

async function sendTelegramMessage(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text
    });
  } catch (error) {
    console.error('Telegram error:', error.response?.data);
  }
}

async function sendInstagramMessage(recipientId, text) {
  try {
    await axios.post(
      `https://graph.instagram.com/v19.0/${BUSINESS_ACCOUNT_ID}/messages`,
      { recipient: { id: recipientId }, message: { text } },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
    console.log('✅ Отправлено в Instagram');
  } catch (error) {
    console.error('❌ Ошибка Instagram:', error.response?.data);
  }
}

// Debug endpoints
app.get('/test-instagram/:userId', async (req, res) => {
  try {
    const response = await axios.post(
      `https://graph.instagram.com/v19.0/${BUSINESS_ACCOUNT_ID}/messages`,
      { recipient: { id: req.params.userId }, message: { text: 'test' } },
      { params: { access_token: PAGE_ACCESS_TOKEN } }
    );
    res.json({ ok: true, data: response.data });
  } catch (err) {
    res.json({ ok: false, error: err.response?.data || err.message });
  }
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
      chat_id: CHAT_ID,
      text: '✅ Railway → Telegram работает!'
    });
    res.json({ ok: true, telegram: result.data });
  } catch (err) {
    res.json({ ok: false, error: err.response?.data || err.message, token_preview: TELEGRAM_TOKEN?.slice(0, 10), chat_id: CHAT_ID });
  }
});

app.get('/health', (req, res) => {
  res.json({
    telegram_token: !!TELEGRAM_TOKEN,
    chat_id: !!CHAT_ID,
    page_access_token: !!PAGE_ACCESS_TOKEN,
    anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    business_account_id: !!BUSINESS_ACCOUNT_ID
  });
});

// Webhook verification
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Входящие сообщения из Instagram
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  if (body.object !== 'instagram') return;

  for (const entry of body.entry) {
    const messaging = entry.messaging;
    if (!messaging) continue;

    for (const event of messaging) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const text = event.message.text || '(без текста)';

      // Получаем профиль клиента
      const user = await getInstagramUser(senderId);
      const name = user?.name || user?.username || null;
      const username = user?.username || null;

      const profileLine = username
        ? `Name: ${name}\nUsername: @${username}\nProfile: https://instagram.com/${username}\nUser ID: ${senderId}`
        : `User ID: ${senderId}`;

      console.log(`📩 Instagram от ${senderId} (${name || 'unknown'}): ${text}`);

      await sendTelegramMessage(
        `New message from Instagram:\n\n${profileLine}\n\nMessage:\n"${text}"\n\n⏳ Генерирую ответ...`
      );

      try {
        const suggested = await generateReply(text, name);
        const key = Date.now().toString();
        pendingReplies[key] = { instagramUserId: senderId, suggestedReply: suggested, clientMessage: text, clientName: name };

        await sendTelegramMessage(
          `🤖 Claude предлагает:\n"${suggested}"\n\nОтправь свой текст чтобы ответить.\nОтправь "+" чтобы принять.`
        );
      } catch (err) {
        console.error('Ошибка Claude:', err.message);
        const key = Date.now().toString();
        pendingReplies[key] = { instagramUserId: senderId, suggestedReply: null, clientMessage: text, clientName: name };
        await sendTelegramMessage(`⚠️ Claude недоступен. Напиши ответ вручную.`);
      }
    }
  }
});

// Твои ответы из Telegram → в Instagram
app.post('/telegram', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.text) return res.sendStatus(200);

  const text = message.text.trim();
  const keys = Object.keys(pendingReplies);

  if (keys.length === 0) {
    await sendTelegramMessage('⚠️ Нет входящих сообщений для ответа.');
    return res.sendStatus(200);
  }

  const lastKey = keys[keys.length - 1];
  const { instagramUserId, suggestedReply, clientMessage } = pendingReplies[lastKey];
  delete pendingReplies[lastKey];

  const finalReply = text === '+' ? suggestedReply : text;

  await sendInstagramMessage(instagramUserId, finalReply);
  saveConversation(clientMessage, finalReply);
  await sendTelegramMessage(`✅ Отправлено: "${finalReply}"`);

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await sendTelegramMessage('Bot is live 🚀');
});
