const express = require('express');
const axios = require('axios');
const Anthropic = require('@anthropic-ai/sdk');
require('dotenv').config();

const app = express();
app.use(express.json());

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ACCOUNT_ID;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// key -> { instagramUserId, suggestedReply }
const pendingReplies = {};

async function generateReply(incomingText) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: `Ты — помощник, который отвечает на сообщения клиентов в Instagram от имени владельца аккаунта.
Пиши коротко, дружелюбно, по-русски. Не используй эмодзи и официальный тон.
Если вопрос про цену или услугу — предложи написать в директ для уточнений.`,
    messages: [{ role: 'user', content: incomingText }]
  });
  return message.content[0].text;
}

async function sendTelegramMessage(text, options = {}) {
  try {
    const res = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text,
      ...options
    });
    return res.data;
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
app.post('/webhook', (req, res) => {
  const body = req.body;
  if (body.object !== 'instagram') return res.sendStatus(404);

  body.entry.forEach(entry => {
    const messaging = entry.messaging;
    if (!messaging) return;

    messaging.forEach(async event => {
      if (!event.message || event.message.is_echo) return;

      const senderId = event.sender.id;
      const text = event.message.text || '(без текста)';
      console.log(`📩 Instagram от ${senderId}: ${text}`);

      // Генерируем ответ через Claude
      const suggested = await generateReply(text);
      const key = Date.now().toString();
      pendingReplies[key] = { instagramUserId: senderId, suggestedReply: suggested };

      // Отправляем тебе в Telegram с предложенным ответом
      await sendTelegramMessage(
        `📩 Клиент написал:\n"${text}"\n\n🤖 Claude предлагает:\n"${suggested}"\n\n✅ Отправь любой текст чтобы ответить (или отправь этот же текст чтобы принять предложение).\nID: ${key}`
      );
    });
  });

  res.sendStatus(200);
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
  const { instagramUserId, suggestedReply } = pendingReplies[lastKey];
  delete pendingReplies[lastKey];

  // Если написал "+" — отправляем предложенный ответ
  const finalReply = text === '+' ? suggestedReply : text;

  await sendInstagramMessage(instagramUserId, finalReply);
  await sendTelegramMessage(`✅ Отправлено: "${finalReply}"`);

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await sendTelegramMessage('Bot is live 🚀 Claude подключён — буду предлагать ответы.');
});
