const express = require('express');
const axios = require('axios');
require('dotenv').config();
const app = express();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ACCOUNT_ID;

// senderId -> Instagram user ID, ожидающий ответа
const pendingReplies = {};

async function sendTelegramMessage(text, options = {}) {
  try {
    const res = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: text,
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
    console.log(`✅ Ответ отправлен в Instagram`);
  } catch (error) {
    console.error('❌ Ошибка отправки в Instagram:', error.response?.data);
  }
}

// Webhook verification
app.use(express.json());

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Входящие сообщения из Instagram
app.post('/webhook', (req, res) => {
  const body = req.body;

  if (body.object === 'instagram') {
    body.entry.forEach(entry => {
      const messaging = entry.messaging;
      if (!messaging) return;

      messaging.forEach(async event => {
        if (event.message && !event.message.is_echo) {
          const senderId = event.sender.id;
          const text = event.message.text || '(без текста)';
          console.log(`📩 Instagram от ${senderId}: ${text}`);

          // Сохраняем senderId под уникальным ключом
          const key = Date.now().toString();
          pendingReplies[key] = senderId;

          // Пересылаем тебе в Telegram
          await sendTelegramMessage(
            `📩 Instagram сообщение:\n\n"${text}"\n\nОтветь на это сообщение чтобы отправить ответ клиенту.\nID: ${key}`
          );
        }
      });
    });
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

// Входящие сообщения из Telegram (твои ответы)
app.post('/telegram', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.text) return res.sendStatus(200);

  const text = message.text.trim();
  console.log(`📨 Telegram от тебя: ${text}`);

  // Ищем последний pending reply
  const keys = Object.keys(pendingReplies);
  if (keys.length === 0) {
    await sendTelegramMessage('⚠️ Нет входящих сообщений для ответа.');
    return res.sendStatus(200);
  }

  const lastKey = keys[keys.length - 1];
  const instagramUserId = pendingReplies[lastKey];
  delete pendingReplies[lastKey];

  await sendInstagramMessage(instagramUserId, text);
  await sendTelegramMessage(`✅ Отправлено в Instagram: "${text}"`);

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await sendTelegramMessage('Bot is live 🚀 Модерация включена — входящие Instagram DM будут приходить сюда.');
});
