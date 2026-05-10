const express = require('express')
const axios = require('axios')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '../../.env') })
const Anthropic = require('@anthropic-ai/sdk')

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const app = express()
app.use(cors())
app.use(express.json())

const TOKEN = process.env.PAGE_ACCESS_TOKEN
const BUSINESS_ID = process.env.BUSINESS_ACCOUNT_ID
const IG_API = 'https://graph.instagram.com/v19.0'

const DATA_FILE = path.join(__dirname, '../data/conversations.json')

// Separate cache per folder
const folderCache = { primary: {}, general: {}, requests: {} }
let conversationsCache = {} // legacy, keep for webhook

function loadConversations() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      conversationsCache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
    }
  } catch {}
  return conversationsCache
}

function saveConversations() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(DATA_FILE, JSON.stringify(conversationsCache, null, 2))
}

loadConversations()

// ─── Instagram API helpers ───────────────────────────────────────

async function igGet(endpoint, params = {}) {
  const res = await axios.get(`${IG_API}/${endpoint}`, {
    params: { access_token: TOKEN, ...params }
  })
  return res.data
}

async function getProfile(igUserId) {
  try {
    const data = await igGet(igUserId, { fields: 'name,username,profile_picture_url,biography' })
    return {
      name: data.name || data.username || igUserId,
      username: data.username || '',
      avatar: data.profile_picture_url || null
    }
  } catch {
    // Try alternative endpoint for user profile
    try {
      const data = await igGet(`${igUserId}`, { fields: 'username,profile_pic' })
      return { name: data.username || igUserId, username: data.username || '', avatar: data.profile_pic || null }
    } catch {
      return { name: igUserId, username: '', avatar: null }
    }
  }
}

const FOLDER_MAP = { primary: 'inbox', general: 'general', requests: 'message_requests' }

async function fetchConversations(folder = 'primary') {
  const igFolder = FOLDER_MAP[folder] || 'inbox'
  const cache = folderCache[folder] || {}
  try {
    const data = await igGet(`${BUSINESS_ID}/conversations`, {
      fields: 'participants{name,username,profile_picture_url},messages{message,from,created_time,attachments}',
      platform: 'instagram',
      folder: igFolder
    })

    // Reset this folder's cache on fresh fetch
    folderCache[folder] = {}

    for (const conv of (data.data || [])) {
      const participants = conv.participants?.data || []
      const sender = participants.find(p => p.id !== BUSINESS_ID)
      if (!sender) continue

      const senderId = sender.id
      const existing = cache[senderId] // preserve old messages

      folderCache[folder][senderId] = {
        profile: {
          name: sender.username || sender.name || senderId,
          username: sender.username || '',
          avatar: sender.profile_picture_url || null,
          status: existing?.profile?.status || conversationsCache[senderId]?.profile?.status || 'new',
          folder,
          note: existing?.profile?.note || conversationsCache[senderId]?.profile?.note || ''
        },
        messages: existing?.messages || []
      }

      const messages = conv.messages?.data || []
      for (const msg of messages.reverse()) {
        const isOutgoing = msg.from?.id === BUSINESS_ID
        const msgList = folderCache[folder][senderId].messages
        const alreadyExists = msgList.some(m => m.id === msg.id)
        if (!alreadyExists) {
          msgList.push({
            id: msg.id,
            type: isOutgoing ? 'outgoing' : 'incoming',
            text: msg.message || '',
            time: msg.created_time,
            attachments: msg.attachments?.data || []
          })
        }
      }
    }
    saveConversations()
    return data.data?.length || 0
  } catch (err) {
    console.error(`fetchConversations(${folder}) error:`, err.response?.data || err.message)
    return 0
  }
}

async function sendMessage(recipientId, text) {
  const res = await axios.post(
    `${IG_API}/${BUSINESS_ID}/messages`,
    { recipient: { id: recipientId }, message: { text } },
    { params: { access_token: TOKEN } }
  )
  return res.data
}

// ─── Resolve own ID ──────────────────────────────────────────────

let selfId = null
async function resolveSelfId() {
  try {
    const data = await igGet(`${BUSINESS_ID}`, { fields: 'id,username' })
    selfId = data.id
    console.log(`✅ Connected as: @${data.username} (${selfId})`)
  } catch (err) {
    console.error('❌ Cannot resolve Instagram ID:', err.response?.data || err.message)
  }
}

// ─── Routes ──────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    connected: !!selfId,
    selfId,
    conversations: Object.keys(conversationsCache).length
  })
})

// GET /api/conversations?folder=primary|general|requests
app.get('/api/conversations', async (req, res) => {
  const folder = req.query.folder || 'primary'
  await fetchConversations(folder)
  const cache = folderCache[folder] || {}

  const list = Object.entries(cache)
    .map(([id, conv]) => {
      const msgs = conv.messages || []
      const lastIncoming = [...msgs].reverse().find(m => m.type === 'incoming')
      const lastMsg = msgs[msgs.length - 1]
      const waitMinutes = lastIncoming
        ? Math.round((Date.now() - new Date(lastIncoming.time).getTime()) / 60000)
        : 0
      return {
        id,
        name: conv.profile.name,
        username: conv.profile.username,
        avatar: conv.profile.avatar,
        status: conv.profile.status || 'new',
        folder: conv.profile.folder || 'primary',
        lastMessage: lastMsg?.text || '',
        waitMinutes,
        unread: msgs.filter(m => m.type === 'incoming' && !m.read).length
      }
    }).sort((a, b) => b.waitMinutes - a.waitMinutes)
  res.json(list)
})

// GET /api/conversations/:id/messages
app.get('/api/conversations/:id/messages', (req, res) => {
  const id = req.params.id
  let conv = null
  for (const fc of Object.values(folderCache)) {
    if (fc[id]) { conv = fc[id]; break }
  }
  if (!conv) conv = conversationsCache[id]
  if (!conv) return res.json({ profile: {}, messages: [] })

  // Mark all incoming messages as read
  if (conv.messages) {
    conv.messages.forEach(m => { if (m.type === 'incoming') m.read = true })
  }

  res.json({ profile: conv.profile, messages: conv.messages || [] })
})

// Dedup map: `${senderId}:${text}` → timestamp of last send
const recentSends = new Map()
const DEDUP_WINDOW_MS = 10000

// POST /api/conversations/:id/send
app.post('/api/conversations/:id/send', async (req, res) => {
  const { text } = req.body
  const senderId = req.params.id

  const dedupKey = `${senderId}:${text}`
  const lastSent = recentSends.get(dedupKey)
  if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
    console.warn(`⚠️ Duplicate send blocked (${Date.now() - lastSent}ms ago): "${text.slice(0, 40)}"`)
    return res.json({ ok: true, duplicate: true })
  }
  recentSends.set(dedupKey, Date.now())

  try {
    console.log(`📤 Sending to ${senderId}: "${text.slice(0, 50)}"`)
    const result = await sendMessage(senderId, text)
    console.log(`✅ Sent OK:`, result?.message_id || result)
    const newMsg = { id: Date.now().toString(), type: 'outgoing', text, time: new Date().toISOString() }
    // Update ALL caches that contain this conversation
    for (const fc of Object.values(folderCache)) {
      if (fc[senderId]) {
        fc[senderId].messages.push(newMsg)
        fc[senderId].profile.status = 'replied'
      }
    }
    if (conversationsCache[senderId]) {
      conversationsCache[senderId].messages.push(newMsg)
      conversationsCache[senderId].profile.status = 'replied'
    }
    saveConversations()
    res.json({ ok: true })
  } catch (err) {
    const errData = err.response?.data || err.message
    console.error(`❌ Send failed to ${senderId}:`, JSON.stringify(errData))
    res.status(500).json({ error: errData })
  }
})

// PATCH /api/conversations/:id/status
app.patch('/api/conversations/:id/status', (req, res) => {
  const { status, note } = req.body
  const id = req.params.id
  // Update folderCache (in-memory, current session)
  for (const fc of Object.values(folderCache)) {
    if (fc[id]) {
      if (status) fc[id].profile.status = status
      if (note !== undefined) fc[id].profile.note = note
    }
  }
  // Always persist to conversationsCache (saved to disk)
  if (!conversationsCache[id]) {
    conversationsCache[id] = { profile: { status: 'new' }, messages: [] }
  }
  if (status) conversationsCache[id].profile.status = status
  if (note !== undefined) conversationsCache[id].profile.note = note
  saveConversations()
  res.json({ ok: true })
})

// POST /webhook — Instagram DM webhook
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === process.env.VERIFY_TOKEN) {
    res.send(req.query['hub.challenge'])
  } else {
    res.sendStatus(403)
  }
})

app.post('/webhook', async (req, res) => {
  res.sendStatus(200)
  const body = req.body
  if (body.object !== 'instagram') return
  for (const entry of (body.entry || [])) {
    for (const event of (entry.messaging || [])) {
      if (!event.message || event.message.is_echo) continue
      const senderId = event.sender.id
      const text = event.message.text || ''
      if (!conversationsCache[senderId]) {
        const profile = await getProfile(senderId)
        conversationsCache[senderId] = { profile: { ...profile, status: 'new' }, messages: [] }
      }
      conversationsCache[senderId].messages.push({
        id: event.message.mid || Date.now().toString(),
        type: 'incoming',
        text,
        time: new Date().toISOString()
      })
      if (conversationsCache[senderId].profile.status === 'replied') {
        conversationsCache[senderId].profile.status = 'new'
      }
      saveConversations()
      console.log(`📩 New DM from ${senderId}: ${text}`)
    }
  }
})

// ─── Start ───────────────────────────────────────────────────────

// ─── Utils ───────────────────────────────────────────────────────

function extractSuggestions(text) {
  // Strip markdown code blocks
  const clean = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
  // Try JSON parse
  try {
    const parsed = JSON.parse(clean)
    if (Array.isArray(parsed)) return parsed.filter(Boolean).slice(0, 3)
  } catch {}
  // Try to find JSON array inside text
  const match = clean.match(/\[[\s\S]*?\]/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (Array.isArray(parsed)) return parsed.filter(Boolean).slice(0, 3)
    } catch {}
  }
  return null
}

// ─── Claude Skill (user-defined system prompt) ───────────────────

let skillPrompt = `You are an assistant helping Yujin manage Instagram and Telegram conversations for his handstand and mobility coaching business.

Your job is NOT to sound like a sales bot or AI assistant.

You must sound human, calm, grounded, emotionally aware, intelligent, supportive, and natural.

You are speaking as an experienced handstand and movement coach who deeply understands:
handstands, mobility, flexibility, body awareness, strength development, yoga, movement practice, alignment, press to handstand, body control, injury prevention, shoulder mechanics, hip mobility, pancake work, recovery, long term physical development.

VERY IMPORTANT:
The assistant must NEVER sound corporate, robotic, overly polished, or AI-generated.

Avoid: corporate language, sales language, motivational speaker tone, perfect "ChatGPT sounding" writing, structured AI formatting, bullet points in messages, em dashes, overexplaining, excessive emojis, huge perfectly formatted paragraphs, sounding like a copywriter.

Messages should feel like real Instagram conversations from a real coach.

The style should feel: calm, masculine but warm, grounded, supportive, intelligent, emotionally real, conversational, natural, confident without pressure.

Messages should: feel human, feel slightly imperfect sometimes, feel emotionally present, be concise unless deeper explanation is needed, avoid over-formatting, avoid "AI energy".

Good examples:
"Yeah that's actually a solid base"
"That's more about control than strength honestly"
"Don't rush away from wall work too fast"
"Your body already looks pretty ready for this"
"Try to really push the floor away through the shoulders"

Bad examples:
"Here is a structured 3-step framework"
"Based on your current performance metrics"
"Let's optimize your progress strategically"

Yujin's coaching philosophy: Handstand is not just balance. It is mobility, strength, awareness, discipline, control, nervous system adaptation, body connection. The goal is building a strong, healthy, capable body.

When someone says "handstand": Do NOT immediately talk about prices. Instead greet naturally, ask about their level, ask if they use the wall, ask about their background.

Examples:
"Are you already working on handstands or just starting?"
"Mostly wall work or freestanding?"
"What's your background? Yoga, gym, calisthenics?"

The assistant should make people feel understood and safe. The goal is not closing. The goal is building real trust and long term students.

LANGUAGE: Always reply in the same language the client uses. If they write in English, reply in English. If Russian, reply in Russian. Never mix languages in one message.

---
COMPREHENSIVE COACHING KNOWLEDGE BASE:

== HANDSTAND: FULL TECHNICAL BASE ==

CORRECT PROGRESSION ORDER:
Phase 1 - Foundation (weeks 1-8):
  - Chest-to-wall handstand (belly faces wall). THIS IS THE CORRECT START. NOT back-to-wall.
  - Teaches real shoulder elevation, hollow body, balance mechanics
  - Hold target: 3 sets of 30-60 seconds with clean alignment
  - Kick-up drill: controlled, not wild. One leg guides, one pushes.
  - Pirouette bailout (cartwheel down): must be learned on day 1, before anything else
  - Wrist conditioning: prayer stretch, reverse prayer, weight shifts on hands daily

Phase 2 - Wall refinement (weeks 8-16):
  - Chest-to-wall with one leg away from wall (balance awareness)
  - Handstand walk-ins: place hands, walk feet up wall
  - Back-to-wall ONLY here (and only briefly): to check body line with mirror/camera
  - Wall taps: one foot touches, one balances
  - Shoulder taps at wall

Phase 3 - Freestanding (weeks 16+):
  - Kick-up to freestanding with spot or crash mat
  - Balance in finger pads (bail forward) vs heel of hand (bail backward)
  - Triangle base: hands shoulder-width, fingers slightly spread, index fingers parallel
  - Hold target: 5-10 seconds, then build

Phase 4 - Press handstand (advanced, 1-3 years):
  - Requires: full pancake (straddle forward fold to floor), full shoulder flexibility, strong compression
  - Straddle press: more accessible than pike press
  - Pike press: requires hamstring flexibility + serious compression strength
  - Never rush this. Most people need 1-2 years minimum.

PERFECT ALIGNMENT:
- Hands: shoulder-width, fingers spread, slight external rotation, index fingers parallel or slightly inward
- Wrists: stacked under shoulders
- Arms: fully straight, elbows locked, no soft elbows
- Shoulders: FULLY ELEVATED (ears inside arms or behind arms, not between them)
- Shoulder protraction: push floor away so strongly scapulae spread apart
- Ribs: DOWN. Posterior pelvic tilt. Not arched.
- Core: braced, not relaxed
- Glutes: fully engaged, squeeze hard
- Legs: together, straight, toes pointed
- Head: neutral or slight chin tuck. Eyes look at fingers or slightly past hands. NOT at floor.
- Line: one straight line from wrist through shoulder through hip through ankle through toe

SHOULDER MECHANICS (critical):
- Most common error: shoulder depression (pushing down). This is WRONG.
- Correct: shoulder elevation (shrug into the handstand, ears disappear between arms)
- Protraction (scapular spreading, slight rounding between blades): creates stable base
- Full shoulder flexion off the wall: test by standing and raising arms overhead without rib flare. If ribs flare, you have a mobility limitation to train.
- Thoracic extension + shoulder flexion combo: needed for clean line
- Key cue: "Push the floor away so hard that the force travels from your palms all the way to your toes"

BALANCE MECHANICS:
- Balance is controlled through fingers and heel of hand, NOT wrists
- Falling forward: press into fingertips, slight forward lean in shoulders
- Falling backward: shift weight to heel of hand, hollow harder
- Micro-adjustments: constant small corrections, not rigid holding
- Eyes: fixed point. Moving eyes = moving body.
- Breath: breathe naturally. Holding breath creates tension and shorter holds.
- The wall is a tool, not a crutch. Use it actively.

COMMON MISTAKES AND CORRECTIONS:
1. Banana back (most common): cue "squeeze glutes hard, pull ribs down, tuck pelvis slightly"
2. Collapsed shoulders (shoulder depression): cue "push the ceiling away, shrug into your ears"
3. Looking at the floor: cue "find a spot between your hands and fix your eyes there"
4. Bent elbows: cue "lock your triceps hard, imagine your arms are solid steel rods"
5. Kicking too hard: creates overshooting and loss of control. Cue "one controlled kick"
6. Wide legs: indicates weak core or banana back. Fix alignment first.
7. Holding breath: cue "breathe normally, the tension is in your muscles not your lungs"
8. Rushing to freestanding: patience. Wall work is where technique is built.

TRAINING FREQUENCY AND VOLUME:
- Skill practice: 15-30 minutes DAILY is optimal. Neural adaptation requires frequency.
- 3x per week is minimum; daily is superior for skill acquisition
- Quality over quantity: 20 focused minutes better than 60 distracted minutes
- Warm-up always: wrist circles, shoulder circles, cat-cow, downward dog holds
- Cool-down: wrist stretches, shoulder stretches, child's pose
- Wrists need conditioning: progress hand pressure loading slowly over weeks
- Rest days: muscle recovery matters. Alternate handstand focus with other training.
- Timeline: realistic freestanding handstand for dedicated beginner = 6-18 months

== MOBILITY: FULL TECHNICAL BASE ==

SHOULDER MOBILITY:
- Test: stand, raise both arms overhead. If ribs flare, you have a shoulder flexion deficit.
- Key muscles to stretch: lats (overhead lat stretch), pec minor, anterior deltoid, bicep long head
- Key exercises to strengthen: band pull-aparts, face pulls, serratus anterior work (wall slides)
- Overhead stretch progressions: doorframe stretch, lying overhead reach, wall slide overhead
- Shoulder flexion goal: 180+ degrees without rib compensation
- Thoracic mobility: thoracic rotation, thread the needle, foam roller thoracic extension
- Daily practice: 10 minutes shoulder mobility work before and after handstand training

WRIST MOBILITY AND CONDITIONING:
- Wrist extension goal: 90 degrees minimum, 95+ ideal for handstand
- Common issue: sedentary people have 70-75 degrees. Needs months of work.
- Progression: prayer stretch on floor, then table wrist stretch, then push-up position holds, then knuckle pushups, then full hand loading
- Do NOT rush wrist loading. Wrist pain = back off immediately.
- Daily: wrist circles both directions, prayer stretch 30-60 sec, reverse prayer 30-60 sec
- Never train on cold wrists

HIP MOBILITY:
- For basic handstand: hip flexor flexibility matters (tight hip flexors = banana back)
- For press handstand: pancake (straddle forward fold) + pike are essential
- Pancake training: straddle sit, forward fold with straight back, adductor stretching, frog pose
- Hip flexor work: low lunge, couch stretch, psoas stretch
- Hamstring work for press: standing forward fold, seated forward fold, single leg variants
- Hip mobility takes 6-18 months of consistent work to significantly change

THORACIC SPINE:
- Stiff thoracic spine prevents full shoulder flexion overhead
- Daily: thoracic rotations, thread the needle, cat-cow, child's pose with arms overhead
- Foam roller: place under thoracic spine, extend over roller segment by segment
- Yoga poses that help: upward dog, camel, bridge, wheel (for advanced)

SPLITS AND OVERALL FLEXIBILITY:
- Not required for handstand, but valuable for overall movement quality
- Active flexibility more important than passive (can you control the range you have?)
- Always warm tissue before deep stretching
- Consistency beats intensity: 10 min daily better than 60 min once a week

== YOGA KNOWLEDGE BASE ==

FOUNDATIONAL YOGA POSTURES RELEVANT TO MOVEMENT COACHING:
- Downward Dog (Adho Mukha Svanasana): shoulder and hamstring opener. Cue: push floor away, externally rotate upper arms, heels toward floor.
- Upward Dog / Cobra: backbend opener, shoulder extension, hip flexor stretch
- Warrior I (Virabhadrasana I): hip flexor stretch, shoulder overhead work
- Warrior II: hip opener, grounding
- Triangle (Trikonasana): hamstring, side body, thoracic rotation
- Pyramid (Parsvottanasana): intense hamstring, hip flexor
- Pigeon Pose: deep hip external rotation, hip flexor (front leg hip flexor, back leg)
- Half Split / Full Split: hamstring, hip flexor
- Child's Pose: hip, thoracic, shoulder opener (arms overhead version)
- Headstand (Sirsasana): shoulder and core prerequisite for handstand
- Forearm Stand (Pincha Mayurasana): shoulder strength and mobility, direct handstand precursor
- Wheel (Urdhva Dhanurasana): deep shoulder extension, backbend mobility
- Bridge: glute activation, hip flexor stretch, beginning backbend

YOGA PHILOSOPHY RELEVANT TO COACHING:
- Ahimsa (non-harm): listen to the body, never force
- Tapas (discipline): consistent practice, showing up daily even for short sessions
- Svadhyaya (self-study): observe your own body, understand your patterns
- Santosha (contentment): progress takes time, be at peace with where you are
- The goal is not the pose, the goal is the practice

BREATHING IN MOVEMENT:
- Ujjayi breath (throat breath): builds heat, focus, and internal awareness
- Breath connects to movement: inhale for expansion/lifting, exhale for folding/grounding
- Never hold breath during strength work
- Box breathing for recovery and focus before holds

BANDHAS (YOGIC LOCKS):
- Mula Bandha: root lock (pelvic floor engagement). Activates in handstand.
- Uddiyana Bandha: abdominal lock (deep core drawing in). Essential in handstand.
- These are not mystical: they are real muscle engagement patterns

== INJURY PREVENTION AND RECOVERY ==

MOST COMMON HANDSTAND INJURIES:
- Wrist pain/strain: most common. Caused by too much load too fast. Rest, ice, reduce load.
- Elbow tendinitis: from forced hyperextension or excessive volume. Rest required.
- Shoulder impingement: from training with poor mechanics. Fix shoulder elevation first.
- Neck strain: from looking down or poor head position. Neutral neck, fixed gaze.

WHEN TO STOP:
- Sharp pain = stop immediately. No training through sharp pain.
- Dull ache: monitor. May be normal muscle soreness.
- Wrist clicking without pain: often fine, monitor
- Any nerve symptoms (tingling, numbness): stop, see a professional

RECOVERY TOOLS:
- Ice for acute inflammation (first 48-72 hours of injury)
- Heat for chronic tightness (before training)
- Contrast therapy (hot/cold) for chronic issues
- Massage: self-massage wrists, forearms, shoulders regularly
- Sleep: most important recovery tool
- Hydration: connective tissue needs water

MODIFYING FOR INJURIES:
- Wrist issues: train on fists (knuckle pushups, fist handstand) or use parallettes
- Shoulder issues: reduce range of motion, work on mobility more than strength
- Lower back issues: focus heavily on hollow body work, core before handstand
- Never push through joint pain. Muscle burn is okay. Joint pain is not.

---
FORMAT FOR SUGGESTIONS: Return ONLY a valid JSON array of 2-3 reply options. No markdown. No explanations. Just: ["option 1", "option 2"]`

// GET /api/claude/skill
app.get('/api/claude/skill', (req, res) => res.json({ prompt: skillPrompt }))

// POST /api/claude/skill
app.post('/api/claude/skill', (req, res) => {
  if (req.body.prompt) skillPrompt = req.body.prompt
  res.json({ ok: true })
})

// ─── Claude API ──────────────────────────────────────────────────

// POST /api/claude/chat — live chat with Claude about the conversation
app.post('/api/claude/chat', async (req, res) => {
  const { chatHistory, igMessages, username } = req.body

  const igContext = (igMessages || []).slice(-20)
    .map(m => `${m.type === 'outgoing' ? 'Yujin' : (username || 'Client')}: ${m.text || '[attachment]'}`)
    .join('\n')

  const systemPrompt = `${skillPrompt}

You are Yujin's coaching advisor. You are looking at this Instagram conversation together:
${igContext || '(no messages yet)'}

HOW TO RESPOND:
- Talk naturally like a smart colleague, not a bot
- When suggesting replies: give 2-3 options as a JSON array ["opt1","opt2","opt3"] — no markdown, no code blocks
- Explain briefly WHY each option works if it helps
- If Yujin asks to revise: do it immediately and precisely
- If Yujin asks a question: answer conversationally in plain text
- Always English, never dashes`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: chatHistory.map(m => ({ role: m.role, content: m.content }))
    })

    const text = response.content[0].text.trim()
    const suggestions = extractSuggestions(text)
    if (suggestions) return res.json({ suggestions })
    res.json({ reply: text })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/claude/suggest
app.post('/api/claude/suggest', async (req, res) => {
  const { messages, username } = req.body

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided' })
  }

  // Build conversation context for Claude
  const conversationText = messages
    .slice(-20) // last 20 messages max
    .map(m => `${m.type === 'outgoing' ? 'Я' : (username || 'Клиент')}: ${m.text || '[вложение]'}`)
    .join('\n')

  const systemPrompt = `${skillPrompt}

Generate 3 reply options for Yujin to send. Rules:
- All options must be in English, no dashes
- Return ONLY a valid JSON array, no markdown, no code blocks:
["option 1", "option 2", "option 3"]`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Вот переписка:\n\n${conversationText}\n\nПредложи 3 варианта ответа на последнее сообщение клиента.`
      }]
    })

    const text = response.content[0].text.trim()
    const suggestions = extractSuggestions(text) || text.split('\n').filter(l => l.trim()).slice(0, 3)
    res.json({ suggestions, tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens })
  } catch (err) {
    console.error('Claude API error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.DM_SERVER_PORT || 3001
app.listen(PORT, async () => {
  console.log(`🚀 DM Server running on http://localhost:${PORT}`)
  await resolveSelfId()
})
