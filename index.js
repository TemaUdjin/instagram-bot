const express = require('express');
const axios = require('axios');
require('dotenv').config();
const app = express();

app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const BUSINESS_ACCOUNT_ID = process.env.BUSINESS_ACCOUNT_ID;

// Функция для отправки ответа
async function sendMessage(recipientId, text) {
  try {
    const response = await axios.post(
      `https://graph.instagram.com/v25.0/${BUSINESS_ACCOUNT_ID}/messages`,
      {
        messaging_type: 'RESPONSE',
        recipient: { id: recipientId },
        message: { text: text }
      },
      {
        params: { access_token: PAGE_ACCESS_TOKEN }
      }
    );
    console.log(`✉️  Ответ отправлен пользователю ${recipientId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Ошибка отправки:', error.response?.data || error.message);
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
  const body = req.body;

  if (body.object === 'instagram') {
    body.entry.forEach(entry => {
      const messaging = entry.messaging;
      if (messaging) {
        messaging.forEach(event => {
          if (event.message && !event.message.is_echo) {
            const senderId = event.sender.id;
            const text = event.message.text;
            console.log(`📩 Message from ${senderId}: ${text}`);

            // Отправляем автоответ
            const reply = `Спасибо за сообщение! Вы написали: "${text}"`;
            sendMessage(senderId, reply);
          }
        });
      }
    });
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.listen(3000, () => {
  console.log('🚀 Server running on http://localhost:3000');
});
