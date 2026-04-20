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

const pendingReplies = {};

function saveConversation(clientMessage, finalReply) {
  let log = [];
  if (fs.existsSync(LOG_FILE)) {
    try { log = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch {}
  }
  log.push({ date: new Date().toISOString(), client: clientMessage, reply: finalReply });
  fs.writeFileSync(LOG_FILE, JSON.stringify(log, null, 2));
}

function removeDashes(text) {
  return text
    .replace(/\s*—\s*/g, '. ')
    .replace(/\s*–\s*/g, '. ')
    .replace(/\s+-\s+/g, '. ')
    .replace(/\.\s*\.\s*/g, '. ')
    .trim();
}

async function getInstagramUser(userId) {
  try {
    const res = await axios.get(`https://graph.instagram.com/v19.0/${userId}`, {
      params: { fields: 'name,username', access_token: PAGE_ACCESS_TOKEN }
    });
    console.log('Instagram user data:', JSON.stringify(res.data));
    return res.data;
  } catch (err) {
    console.error('getInstagramUser error:', err.response?.data || err.message);
    return null;
  }
}

async function generateReply(incomingText, clientName) {
  const nameHint = clientName ? `The client's name is ${clientName}. Use their name naturally once if it feels right.` : '';
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 150,
    system: `You are a high-level coach in mobility, flexibility, handstand, bodyweight strength, and yoga. You understand joint health and basic rehab. Not a doctor, a practical coach.

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

RULES: Never dump info. If unsure what they need, ask. Respond in the same language the client writes in.

${nameHint}`,
    messages: [{ role: 'user', content: incomingText }]
  });
  return removeDashes(message.content[0].text.trim());
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
  const payload = { recipient: { id: recipientId }, message: { text } };
  const endpoints = [
    `https://graph.instagram.com/v21.0/${BUSINESS_ACCOUNT_ID}/messages`,
    `https://graph.instagram.com/v19.0/${BUSINESS_ACCOUNT_ID}/messages`,
    `https://graph.facebook.com/v19.0/me/messages`,
  ];

  for (const url of endpoints) {
    try {
      console.log(`📤 Trying: ${url}`);
      console.log(`📤 Payload: ${JSON.stringify(payload)}`);
      const res = await axios.post(url, payload, {
        params: { access_token: PAGE_ACCESS_TOKEN }
      });
      console.log(`✅ Instagram success (${url}):`, JSON.stringify(res.data));
      await sendTelegramMessage(`✅ Sent via ${url.includes('facebook') ? 'Facebook' : 'Instagram'} API`);
      return;
    } catch (err) {
      const errData = err.response?.data || err.message;
      console.error(`❌ Failed (${url}):`, JSON.stringify(errData));
      await sendTelegramMessage(`❌ Failed ${url.split('/')[2]}: ${JSON.stringify(errData)}`);
    }
  }
}

function buildClientCard(user, senderId) {
  if (!user || (!user.name && !user.username)) {
    return `User ID: ${senderId}`;
  }
  const name = user.name || user.username;
  const username = user.username;
  if (username) {
    return `Name: ${name}\nUsername: @${username}\nProfile: https://instagram.com/${username}\nUser ID: ${senderId}`;
  }
  return `Name: ${name}\nUser ID: ${senderId}`;
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

app.get('/test-user/:userId', async (req, res) => {
  const user = await getInstagramUser(req.params.userId);
  res.json({ user });
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
      chat_id: CHAT_ID, text: '✅ Railway → Telegram работает!'
    });
    res.json({ ok: true, telegram: result.data });
  } catch (err) {
    res.json({ ok: false, error: err.response?.data || err.message, chat_id: CHAT_ID });
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

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const body = req.body;
  console.log('WEBHOOK PAYLOAD:', JSON.stringify(body, null, 2));

  if (body.object !== 'instagram') return;

  for (const entry of body.entry) {
    const messaging = entry.messaging;
    if (!messaging) continue;

    for (const event of messaging) {
      if (!event.message || event.message.is_echo) continue;

      const senderId = event.sender.id;
      const text = event.message.text || '(no text)';

      console.log('SENDER OBJECT:', JSON.stringify(event.sender));

      const user = await getInstagramUser(senderId);
      const clientCard = buildClientCard(user, senderId);
      const clientName = user?.name || user?.username || null;

      await sendTelegramMessage(
        `New message from Instagram:\n\n${clientCard}\n\nMessage:\n"${text}"\n\n⏳ Generating reply...`
      );

      try {
        const suggested = await generateReply(text, clientName);
        const key = Date.now().toString();
        pendingReplies[key] = { instagramUserId: senderId, suggestedReply: suggested, clientMessage: text };

        await sendTelegramMessage(
          `🤖 Suggested reply:\n"${suggested}"\n\nSend your own text to reply.\nSend "+" to accept this suggestion.`
        );
      } catch (err) {
        console.error('Claude error:', err.message);
        const key = Date.now().toString();
        pendingReplies[key] = { instagramUserId: senderId, suggestedReply: null, clientMessage: text };
        await sendTelegramMessage(`⚠️ Claude unavailable. Reply manually.`);
      }
    }
  }
});

app.post('/telegram', async (req, res) => {
  const message = req.body.message;
  if (!message || !message.text) return res.sendStatus(200);

  const text = message.text.trim();
  const keys = Object.keys(pendingReplies);

  if (keys.length === 0) {
    await sendTelegramMessage('⚠️ No pending messages to reply to.');
    return res.sendStatus(200);
  }

  const lastKey = keys[keys.length - 1];
  const { instagramUserId, suggestedReply, clientMessage } = pendingReplies[lastKey];
  delete pendingReplies[lastKey];

  const finalReply = text === '+' ? suggestedReply : text;

  await sendInstagramMessage(instagramUserId, finalReply);
  saveConversation(clientMessage, finalReply);
  await sendTelegramMessage(`✅ Sent: "${finalReply}"`);

  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  await sendTelegramMessage('Bot is live 🚀');
});
