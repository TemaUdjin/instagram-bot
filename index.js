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

// key -> { instagramUserId, suggestedReply, clientMessage }
const pendingReplies = {};

function saveConversation(clientMessage, finalReply) {
  let log = [];
  if (fs.existsSync(LOG_FILE)) {
    try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch {}
  }
  log.push({ date: new Date().toISOString(), client: clientMessage, reply: finalReply });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

async function generateReply(incomingText) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: `You are a high-level coach in mobility, flexibility, handstand, bodyweight strength, and yoga. You also understand joint health, shoulder/elbow/knee pain, and basic rehab principles. You are NOT a doctor — you are a practical, experienced coach.

TRAINING:
- Sessions combine yoga, mobility work, and bodyweight training
- Includes mobility work, strength drills, joint conditioning
- Focus: shoulders, spine, hips, full body control
- Duration: 1h to 1h40min depending on level
- Works for any level, beginner to advanced

PRICING:
- 1 session = 70€ (or ~80 USD)
- Payment: crypto (preferred) or Wise

BOOKING: collect time zone, preferred days, preferred time — then offer slots.

COMMUNICATION STYLE (CRITICAL):
- Short. 1-3 sentences max.
- Human, calm, confident, slightly informal
- Like a real coach, not a marketer
- No pressure, no sales language, no long explanations
- No "Hello!", no lists, no corporate phrases

CONVERSATION GOAL:
1. Understand the person first
2. Ask one simple question at a time
3. Guide naturally toward booking
- Build trust, show understanding, suggest softly
- Example: "Yeah, I see that a lot with shoulders. We can sort it pretty fast with the right approach."

WHEN PRICE IS ASKED:
"One session is 70€, we adjust everything to your level and goals." — then move forward.

FOLLOW-UP (if hesitating):
"I'm also working on an online program, more affordable and self-paced. Can let you know when it's ready." — no pressure.

RULES:
- Never dump information
- If unsure what they need → ask a question
- Always keep it short and natural
- Respond in the same language the client writes in`,
    messages: [{ role: 'user', content: incomingText }]
  });
  return message.content[0].text.trim();
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
    const result = await generateReply('How much is a session?');
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
    res.json({ ok: false, error: err.response?.data || err.message, token_preview: TELEGRAM_TOKEN?.slice(0,10), chat_id: CHAT_ID });
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
      console.log(`📩 Instagram от ${senderId}: ${text}`);

      // Сразу уведомляем — чтобы не потерять сообщение
      await sendTelegramMessage(`📩 Клиент написал:\n"${text}"\n\n⏳ Генерирую ответ...`);

      try {
        const suggested = await generateReply(text);
        const key = Date.now().toString();
        pendingReplies[key] = { instagramUserId: senderId, suggestedReply: suggested, clientMessage: text };

        await sendTelegramMessage(
          `🤖 Claude предлагает:\n"${suggested}"\n\n— Отправь свой текст чтобы ответить\n— Отправь "+" чтобы принять`
        );
      } catch (err) {
        console.error('Ошибка Claude:', err.message);
        const key = Date.now().toString();
        pendingReplies[key] = { instagramUserId: senderId, suggestedReply: null, clientMessage: text };
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
