const express = require('express');
const app = express();

app.use(express.json());

const VERIFY_TOKEN = 'my_secret_token_123';

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
          if (event.message) {
            const senderId = event.sender.id;
            const text = event.message.text;
            console.log(`📩 Message from ${senderId}: ${text}`);
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
