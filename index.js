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
    system: `Ты отвечаешь на сообщения клиентов в Instagram от имени тренера.

Стиль:
- коротко (1-3 предложения максимум)
- по-человечески, уверенно
- как тренер, не маркетолог
- без продажного тона
- без корпоративного языка
- без длинных объяснений

Запрещено:
- "Здравствуйте!", "Рад приветствовать"
- Перечисления и списки
- Фразы типа "Наши услуги включают..."

Если спрашивают цену или детали — уточни цель/уровень клиента прежде чем отвечать.`,
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

      const suggested = await generateReply(text);
      const key = Date.now().toString();
      pendingReplies[key] = { instagramUserId: senderId, suggestedReply: suggested, clientMessage: text };

      await sendTelegramMessage(
        `📩 Клиент:\n"${text}"\n\n🤖 Claude предлагает:\n"${suggested}"\n\n— Отправь свой текст чтобы ответить\n— Отправь "+" чтобы принять предложение`
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
