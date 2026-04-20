const express = require('express');
const axios = require('axios');
require('dotenv').config();
const app = express();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

async function sendTelegramMessage(text) {
  try {
    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      chat_id: CHAT_ID,
      text: text
    });
  } catch (error) {
    console.error('Telegram error:', error.response?.data);
  }
}

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ACCOUNT_ID;
const BOT_ENABLED = process.env.BOT_ENABLED !== 'false';

// Функция для отправки ответа
async function sendMessage(recipientId, text) {
  try {
    console.log(`📤 Пытаюсь отправить сообщение пользователю ${recipientId}: "${text}"`);
    // Используем эндпоинт для отправки через Instagram Graph API
    const response = await axios.post(
      `https://graph.instagram.com/v19.0/${BUSINESS_ACCOUNT_ID}/messages`,
      {
        recipient: { id: recipientId },
        message: { text: text }
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN }
      }
    );
    console.log(`✉️  ✅ Ответ успешно отправлен!`);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка отправки:');
    console.error('Status:', error.response?.status);
    console.error('Error:', error.response?.data);
  }
}

// Webhook verification (Meta calls this once when you connect)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified by Meta!');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Receive messages from Instagram
app.post('/webhook', (req, res) => {
  console.log('\n🔥 FULL WEBHOOK BODY:');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('\n');

  const body = req.body;

  if (body.object === 'instagram') {
    console.log('✅ Object is instagram');
    body.entry.forEach(entry => {
      console.log('Entry ID:', entry.id);
      const messaging = entry.messaging;
      if (messaging) {
        console.log(`📬 Messaging events: ${messaging.length}`);
        messaging.forEach(event => {
          console.log('Event:', JSON.stringify(event).substring(0, 150));
          if (event.message && !event.message.is_echo) {
            const senderId = event.sender.id;
            const text = event.message.text;
            console.log(`📩 Message from ${senderId}: ${text}`);

            if (!BOT_ENABLED) {
              console.log('🔇 Bot is disabled, skipping reply');
              return;
            }

            // auto-reply disabled
          }
        });
      } else {
        console.log('⚠️ No messaging in entry');
      }
    });
    res.sendStatus(200);
  } else {
    console.log('❌ Object is not instagram:', body.object);
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  sendTelegramMessage('Bot is live 🚀');
});
