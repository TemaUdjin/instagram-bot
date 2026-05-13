import { useState, useEffect, useRef } from 'react'
import { SendIcon } from './Icons'
import { api, ConversationDetail } from '../api'

function ClientIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )
}

const MOCK_MESSAGES = [
  { type: 'incoming', text: 'Hi! I\'d like to learn more about the flexibility course. I\'m 45, never done yoga before.', time: '14:20' },
  { type: 'outgoing', text: 'Hey! Great that you reached out — there\'s a perfect entry point for your age and level. Do you have any limitations or injuries?', time: '14:35' },
  { type: 'incoming', text: 'No injuries, but my back bothers me sometimes. Desk job.', time: '14:38' },
]

interface DialogProps {
  conversationId: string | null
  serverOnline?: boolean
  refreshKey?: number
  pendingSentText?: { text: string; ts: number } | null
  prefillText?: { text: string; ts: number } | null
  onAskClaude?: (messages: any[]) => void
  onSent?: () => void
}

export default function Dialog({ conversationId, refreshKey, pendingSentText, prefillText, onAskClaude, onSent }: DialogProps) {
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [followupSet, setFollowupSet] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [detail, setDetail] = useState<ConversationDetail | null>(null)
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setText('')
    if (!conversationId) { setDetail(null); setIsClient(false); return }
    setDetail(null) // clear stale data before loading new conversation
    setIsClient(false)

    const load = (initial = false) => {
      if (initial) setLoading(true)
      api.messages(conversationId)
        .then(d => {
          if (initial) setIsClient(d?.profile?.status === 'client')
          setDetail(prev => {
            // Keep optimistic messages that don't have a real counterpart yet
            const realTexts = new Set((d?.messages || []).map((m: any) => m.text))
            const optimistic = (prev?.messages || []).filter((m: any) =>
              m.id?.startsWith('opt_') && !realTexts.has(m.text)
            )
            const merged = [...(d?.messages || []), ...optimistic]
            const prevCount = prev?.messages?.length || 0
            if (merged.length > prevCount) {
              setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
            }
            return { ...d, messages: merged }
          })
        })
        .catch(() => {})
        .finally(() => { if (initial) setLoading(false) })
    }

    load(true)
    // Poll for new messages every 8 seconds while this dialog is open
    const interval = setInterval(() => load(false), 8000)
    return () => clearInterval(interval)
  }, [conversationId, refreshKey])

  const messages = detail ? detail.messages : MOCK_MESSAGES
  const profile = detail?.profile

  const displayUsername = profile?.username || ''
  const displayName = profile?.name && profile.name !== conversationId
    ? profile.name
    : displayUsername || `ID:${conversationId?.slice(-6)}`
  const avatar = profile?.avatar || null
  const igLink = displayUsername
    ? `https://instagram.com/${displayUsername}`
    : `https://instagram.com`

  const addMessageOptimistically = (msgText: string) => {
    const newMsg = { id: `opt_${Date.now()}`, type: 'outgoing' as const, text: msgText, time: new Date().toISOString(), attachments: [] }
    setDetail(prev => prev
      ? { ...prev, messages: [...prev.messages, newMsg] }
      : { profile: {}, messages: [newMsg] } as any
    )
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30)
  }

  // Optimistic: add sent message from Claude panel immediately
  useEffect(() => {
    if (!pendingSentText?.text) return
    addMessageOptimistically(pendingSentText.text)
  }, [pendingSentText?.ts])

  // Prefill input from template "Use"
  useEffect(() => {
    if (!prefillText?.text) return
    setText(prefillText.text)
    setTimeout(() => {
      const el = textareaRef.current
      if (!el) return
      el.focus()
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
      el.setSelectionRange(el.value.length, el.value.length)
    }, 30)
  }, [prefillText?.ts])

  const handleSend = async () => {
    if (!text.trim() || !conversationId || sending) return
    const msgText = text.trim()
    setText('')
    addMessageOptimistically(msgText)
    setSending(true)
    try {
      await api.send(conversationId, msgText)
      onSent?.()
    } catch (e) {
      console.error(e)
    } finally {
      setSending(false)
    }
  }

  if (!conversationId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Select a chat</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0" style={{ flex: 1, overflow: 'hidden', background: 'var(--background)' }}>

      {/* Header */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          {avatar
            ? <img src={avatar} className="w-9 h-9 rounded-full shrink-0 object-cover" alt={displayName} />
            : <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: 'var(--avatar-bg)', color: 'var(--avatar-text)' }}>{displayName[0]}</div>
          }
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold" style={{ color: 'var(--msg-username, var(--foreground))' }}>{displayName}</div>
            <a href={igLink} target="_blank" rel="noreferrer" className="text-xs hover:underline" style={{ color: 'var(--muted-foreground)' }}>
              {displayUsername ? `@${displayUsername}` : 'Instagram'} ↗
            </a>
          </div>
          {/* Actions */}
          <div className="flex items-center gap-1">
            {/* Mark as Client */}
            <button
              onClick={async () => {
                const next = isClient ? 'replied' : 'client'
                setIsClient(!isClient)
                await api.setStatus(conversationId!, next)
                onSent?.()
              }}
              title={isClient ? 'Remove client' : 'Mark as client'}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all"
              style={{
                color: isClient ? 'var(--status-client)' : 'var(--muted-foreground)',
                background: isClient ? 'rgba(78,201,148,0.12)' : 'transparent',
                border: isClient ? '1px solid rgba(78,201,148,0.3)' : '1px solid transparent',
                cursor: 'pointer'
              }}
            >
              ⭐ {isClient ? 'Client' : 'Add client'}
            </button>
            <button
              onClick={() => setShowNote(n => !n)}
              title="Client note"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: showNote ? 'var(--accent)' : 'var(--muted-foreground)', background: showNote ? 'var(--muted)' : 'transparent', cursor: 'pointer' }}
            >
              <NoteIcon />
            </button>
            <button
              onClick={() => setFollowupSet(f => !f)}
              title="Follow-up in 3 days"
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: followupSet ? '#f59e0b' : 'var(--muted-foreground)', background: followupSet ? 'var(--muted)' : 'transparent', cursor: 'pointer' }}
            >
              <BellIcon />
            </button>
          </div>
        </div>

        {/* Follow-up banner */}
        {followupSet && (
          <div className="mx-5 mb-2 px-3 py-1.5 rounded-lg flex items-center gap-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span style={{ fontSize: 11, color: '#f59e0b' }}>🔔 Follow-up in 3 days</span>
            <button onClick={() => setFollowupSet(false)} style={{ marginLeft: 'auto', color: '#f59e0b', fontSize: 11, cursor: 'pointer', background: 'none', border: 'none' }}>✕</button>
          </div>
        )}

        {/* Notes */}
        {showNote && (
          <div className="mx-5 mb-2">
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Notes about client (only visible to you)..."
              className="w-full resize-none outline-none rounded-lg px-3 py-2"
              rows={2}
              style={{ fontSize: 11, background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
            />
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.type === 'outgoing' ? 'justify-end' : 'justify-start'}`}>

            {/* Avatar for incoming */}
            {msg.type === 'incoming' && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-1"
                style={{ background: 'var(--avatar-bg)', color: 'var(--avatar-text)' }}
              >
                A
              </div>
            )}

            <div
              className="max-w-sm rounded-2xl text-xs leading-relaxed"
              style={
                msg.type === 'outgoing'
                  ? {
                      background: 'var(--msg-outgoing-bg, var(--card))',
                      color: 'var(--msg-outgoing-color, var(--foreground))',
                      padding: '10px 14px',
                      borderRadius: '18px 18px 4px 18px',
                      borderLeft: '2px solid var(--accent)',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
                    }
                  : {
                      background: 'var(--msg-incoming-bg, var(--muted))',
                      color: 'var(--msg-incoming-color, var(--foreground))',
                      padding: '10px 14px',
                      borderRadius: '18px 18px 18px 4px',
                      border: '1px solid var(--border)',
                    }
              }
            >
              <p style={{ marginBottom: 4, opacity: msg.text ? 1 : 0.5 }}>
                {msg.text || ((msg as any).attachments?.length ? '📎 Attachment' : '🎤 Voice')}
              </p>
              <span style={{ fontSize: 10, color: 'var(--msg-time, var(--muted-foreground))', float: 'right', marginLeft: 8 }}>
                {msg.time?.length > 5 ? new Date(msg.time).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false }) : msg.time}
              </span>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Ask Claude — prominent button above input */}
      <div className="px-4 pt-2 pb-1 border-t" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => onAskClaude?.(messages)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'var(--muted)', color: 'var(--accent)', border: '1px solid var(--border)', cursor: 'pointer' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--card)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--muted)' }}
        >
          <span style={{ fontSize: 14 }}>✦</span>
          Ask Claude — get reply options
        </button>
      </div>

      {/* Input */}
      <div className="px-4 py-2" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex items-end gap-2 px-4 py-3 rounded-xl"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your reply..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
            style={{ color: 'var(--foreground)' }}
            onInput={(e) => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 120) + 'px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleSend() }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="p-1.5 rounded-lg shrink-0 disabled:opacity-30 transition-all"
            style={{
              background: text.trim() ? 'var(--accent)' : 'transparent',
              color: text.trim() ? '#1a1610' : 'var(--muted-foreground)',
              cursor: text.trim() && !sending ? 'pointer' : 'default'
            }}
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}>⌘↵ send</p>
      </div>
    </div>
  )
}
