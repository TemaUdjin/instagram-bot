import { useState, useRef, useEffect } from 'react'
import TemplatesPanel, { loadTemplates, Template } from './TemplatesPanel'

const MODELS = [
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'Fast · smart' },
  { id: 'claude-opus-4-7', label: 'Opus 4.7', desc: 'Powerful · pricier' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5', desc: 'Fast · cheap' },
]

const CONTEXT_LIMIT = 200000
const MOCK_USED = 14300

interface Message {
  role: 'claude' | 'user'
  type: 'text' | 'suggestions'
  content?: string
  suggestions?: string[]
}

const INITIAL_MESSAGES: Message[] = [
  {
    role: 'claude',
    type: 'text',
    content: 'Analyzing conversation... Here are my suggestions:'
  },
  {
    role: 'claude',
    type: 'suggestions',
    suggestions: [
      'Back pain from sitting is exactly what we work on first. We\'ll start with spine mobility. Want me to send you a trial session?',
      'Great — back pain from a desk job is very common. There\'s a beginner program focused on the spine. When would be a good time to start?',
      'The back is our priority at the foundation level. I\'ll show you 3 movements that release tension after the very first session. Shall we try?'
    ]
  }
]

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

interface SuggestionsPanelProps {
  conversationId: string | null
  onSelect: (text: string) => void
  onSent?: () => void
  onUseTemplate?: (text: string) => void
  trigger?: { conversationId: string | null; messages: any[]; ts: number } | null
}

export default function SuggestionsPanel({ conversationId, onSelect, onSent, onUseTemplate, trigger }: SuggestionsPanelProps) {
  const [tab, setTab] = useState<'claude' | 'templates'>('claude')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [model, setModel] = useState(MODELS[0])
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [savingIdx, setSavingIdx] = useState<number | null>(null)
  const [matchHint, setMatchHint] = useState<Template | null>(null)
  const [sending, setSending] = useState(false)
  const [suggestionTranslations, setSuggestionTranslations] = useState<Record<string, string | null>>({})
  const [translatingKey, setTranslatingKey] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const usedPct = Math.round((MOCK_USED / CONTEXT_LIMIT) * 100)
  const barColor = usedPct > 80 ? '#e05252' : usedPct > 50 ? 'var(--accent)' : 'var(--status-client)'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Clear panel when switching to a different conversation
  useEffect(() => {
    setSelected(null)
    setMessages([])
    setMatchHint(null)
    setSending(false)
    setSuggestionTranslations({})
  }, [conversationId])

  const handleTranslateSuggestion = async (text: string) => {
    if (suggestionTranslations[text] !== undefined) {
      setSuggestionTranslations(prev => { const n = { ...prev }; delete n[text]; return n })
      return
    }
    setTranslatingKey(text)
    try {
      const res = await fetch('http://localhost:3001/api/claude/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      const data = await res.json()
      setSuggestionTranslations(prev => ({ ...prev, [text]: data.translation || null }))
    } catch {
      // ignore
    } finally {
      setTranslatingKey(null)
    }
  }

  // React to "Ask Claude" button — call real API
  useEffect(() => {
    if (!trigger?.ts) return
    const msgs = trigger.messages || []
    if (!msgs.length) return

    setSelected(null)
    setTab('claude')
    setMatchHint(null)

    // Smart match: check if last incoming message resembles a saved template
    const lastIncoming = [...msgs].reverse().find((m: any) => m.type === 'incoming')
    if (lastIncoming?.text) {
      const words = lastIncoming.text.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
      const templates = loadTemplates()
      const matched = templates.find(t => {
        const haystack = (t.question + ' ' + t.answer).toLowerCase()
        return words.filter((w: string) => haystack.includes(w)).length >= 2
      })
      if (matched) setMatchHint(matched)
    }

    setMessages([{ role: 'claude', type: 'text', content: 'Analyzing conversation...' }])

    fetch('http://localhost:3001/api/claude/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: msgs, username: trigger.conversationId })
    })
      .then(r => r.json())
      .then(data => {
        if (data.suggestions) {
          setMessages([
            { role: 'claude', type: 'suggestions', suggestions: data.suggestions }
          ])
        } else {
          setMessages([{ role: 'claude', type: 'text', content: `Error: ${data.error}` }])
        }
      })
      .catch(err => {
        setMessages([{ role: 'claude', type: 'text', content: `Connection error: ${err.message}` }])
      })
  }, [trigger?.ts])

  const copySuggestion = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 1500)
  }

  const saveSuggestion = (text: string, idx: number) => {
    const existing = loadTemplates()
    const t: Template = {
      id: `t_${Date.now()}`,
      question: '',
      answer: text,
      tags: [],
      usedCount: 0,
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem('tp_templates', JSON.stringify([t, ...existing]))
    setSavingIdx(idx)
    setTimeout(() => setSavingIdx(null), 1500)
  }

  if (!conversationId) {
    return (
      <div className="flex flex-col h-full border-l" style={{ borderColor: 'var(--border)' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Claude</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4 text-center">
          <div style={{ fontSize: 28 }}>✦</div>
          <p className="text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Open a chat</p>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Click 'Ask Claude' to get reply options</p>
        </div>
      </div>
    )
  }

  const handleSend = async () => {
    if (!input.trim()) return
    const userMsg = input.trim()
    setInput('')

    const updatedMessages = [...messages, { role: 'user' as const, type: 'text' as const, content: userMsg }]
    setMessages(updatedMessages)

    // Build chat history for Claude
    const chatHistory = updatedMessages
      .filter(m => m.type === 'text')
      .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content || '' }))

    try {
      const res = await fetch('http://localhost:3001/api/claude/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatHistory,
          igMessages: trigger?.messages || [],
          username: trigger?.conversationId || ''
        })
      })
      const data = await res.json()
      if (data.suggestions) {
        setMessages(prev => [...prev, { role: 'claude', type: 'suggestions', suggestions: data.suggestions }])
      } else if (data.reply) {
        setMessages(prev => [...prev, { role: 'claude', type: 'text', content: data.reply }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'claude', type: 'text', content: 'Connection error' }])
    }
  }

  return (
    <div className="flex flex-col h-full border-l" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>

      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setTab('claude')}
          className="flex-1 py-2.5 text-xs font-medium transition-colors"
          style={{
            color: tab === 'claude' ? 'var(--foreground)' : 'var(--muted-foreground)',
            borderBottom: tab === 'claude' ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent', cursor: 'pointer',
          }}
        >
          ✦ Claude
        </button>
        <button
          onClick={() => setTab('templates')}
          className="flex-1 py-2.5 text-xs font-medium transition-colors"
          style={{
            color: tab === 'templates' ? 'var(--foreground)' : 'var(--muted-foreground)',
            borderBottom: tab === 'templates' ? '2px solid var(--accent)' : '2px solid transparent',
            background: 'transparent', cursor: 'pointer',
          }}
        >
          // templates
        </button>
      </div>

      {/* Templates tab */}
      {tab === 'templates' && (
        <TemplatesPanel onUse={(text) => { onUseTemplate?.(text); setTab('claude') }} />
      )}

      {/* Claude tab — header */}
      {tab === 'claude' && <div className="px-3 pt-3 pb-2 border-b" style={{ borderColor: 'var(--border)' }}>

        {/* Top row: Claude + style badge + status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Claude</span>
            <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--muted)', color: 'var(--accent)', fontSize: 10 }}>
              Style 87%
            </span>
          </div>
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--status-client)' }} />
        </div>

        {/* Model switcher */}
        <div className="relative mb-2">
          <button
            onClick={() => setShowModelPicker(p => !p)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md w-full transition-colors"
            style={{ background: 'var(--muted)', cursor: 'pointer' }}
          >
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Model</span>
            <span style={{ fontSize: 11, color: 'var(--foreground)', fontWeight: 500 }}>{model.label}</span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>▾</span>
          </button>

          {showModelPicker && (
            <div
              className="absolute left-0 right-0 top-full mt-1 rounded-lg overflow-hidden z-50"
              style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}
            >
              {MODELS.map(m => (
                <button
                  key={m.id}
                  onClick={() => { setModel(m); setShowModelPicker(false) }}
                  className="flex items-center justify-between w-full px-3 py-2 transition-colors"
                  style={{
                    background: m.id === model.id ? 'var(--muted)' : 'transparent',
                    cursor: 'pointer',
                    borderLeft: m.id === model.id ? '2px solid var(--accent)' : '2px solid transparent'
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--foreground)', fontWeight: m.id === model.id ? 600 : 400 }}>{m.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>{m.desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Context / tokens bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>Context</span>
            <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>
              {(MOCK_USED / 1000).toFixed(1)}k / {(CONTEXT_LIMIT / 1000).toFixed(0)}k · {usedPct}%
            </span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'var(--muted)' }}>
            <div style={{ width: `${usedPct}%`, height: '100%', background: barColor, borderRadius: 9999, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>}

      {/* Claude tab — chat body */}
      {tab === 'claude' && <>

        {/* Smart match hint */}
        {matchHint && (
          <div
            className="mx-3 mt-2 px-3 py-2 rounded-lg flex items-center gap-2"
            style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
          >
            <span style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', fontFamily: 'inherit' }}>// similar template found</span>
            <button
              onClick={() => { setTab('templates'); setMatchHint(null) }}
              style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              view →
            </button>
            <button
              onClick={() => setMatchHint(null)}
              style={{ fontSize: 11, color: 'var(--muted-foreground)', cursor: 'pointer', background: 'none', border: 'none' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center mt-8">
              <div style={{ fontSize: 24, opacity: 0.4 }}>✦</div>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
                Press 'Ask Claude' in the chat
              </p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i}>
              {msg.type === 'text' && (
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="text-xs leading-relaxed px-3 py-2 rounded-xl max-w-[85%]"
                    style={msg.role === 'user'
                      ? { background: 'var(--card)', color: 'var(--foreground)', border: '1px solid var(--border)' }
                      : { color: 'var(--muted-foreground)' }
                    }
                  >
                    {msg.content}
                  </div>
                </div>
              )}

              {(msg.type as string) === 'image' && (
                <div className="flex justify-end">
                  <img
                    src={msg.content}
                    alt="screenshot"
                    className="rounded-xl"
                    style={{ maxWidth: '85%', maxHeight: 200, objectFit: 'cover', border: '1px solid var(--border)' }}
                  />
                </div>
              )}

              {msg.type === 'suggestions' && msg.suggestions && (
                <div className="flex flex-col gap-2">
                  {msg.suggestions.map((s, j) => (
                    <div key={j} className="flex flex-col gap-1">
                      <button
                        onClick={() => setSelected(s)}
                        className="text-left text-xs leading-relaxed px-3 py-2.5 rounded-xl transition-all w-full"
                        style={{
                          background: selected === s ? 'var(--card)' : 'var(--muted)',
                          color: 'var(--foreground)',
                          border: selected === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                          cursor: 'pointer'
                        }}
                      >
                        <div className="flex gap-2">
                          <span style={{ color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{j + 1}</span>
                          <span style={{ color: 'var(--claude-text, var(--foreground))' }}>{s}</span>
                        </div>
                        {suggestionTranslations[s] && (
                          <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: 4, paddingLeft: 18 }}>
                            {suggestionTranslations[s]}
                          </div>
                        )}
                      </button>
                      {/* Actions: translate / copy / save */}
                      <div className="flex gap-1.5 px-1">
                        <button
                          onClick={() => handleTranslateSuggestion(s)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs transition-all"
                          style={{
                            background: 'transparent',
                            color: suggestionTranslations[s] ? 'var(--hack-comment-color, var(--muted-foreground))' : 'var(--muted-foreground)',
                            cursor: translatingKey === s ? 'default' : 'pointer',
                            opacity: translatingKey === s ? 0.5 : 1,
                          }}
                        >
                          {translatingKey === s ? '...' : suggestionTranslations[s] ? '✓ translated' : 'translate'}
                        </button>
                        <button
                          onClick={() => copySuggestion(s, j)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs transition-all"
                          style={{
                            background: 'transparent',
                            color: copiedIdx === j ? 'var(--status-client)' : 'var(--muted-foreground)',
                            cursor: 'pointer',
                          }}
                        >
                          {copiedIdx === j ? '✓ copied' : 'copy'}
                        </button>
                        <button
                          onClick={() => saveSuggestion(s, j)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs transition-all"
                          style={{
                            background: 'transparent',
                            color: savingIdx === j ? 'var(--status-client)' : 'var(--muted-foreground)',
                            cursor: 'pointer',
                          }}
                        >
                          {savingIdx === j ? '✓ saved' : 'save'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </>}

      {/* Send selected */}
      {tab === 'claude' && selected && (
        <div className="px-3 pb-2">
          <button
            disabled={sending}
            className="w-full py-2 rounded-lg text-xs font-medium"
            style={{
              background: sending ? 'var(--muted)' : 'var(--accent)',
              color: sending ? 'var(--muted-foreground)' : '#1a1610',
              cursor: sending ? 'default' : 'pointer',
              opacity: sending ? 0.6 : 1
            }}
            onClick={async () => {
              if (!conversationId || !selected || sending) return
              const msgText = selected
              setSending(true)
              setSelected(null)
              onSelect(msgText)
              fetch(`http://localhost:3001/api/conversations/${conversationId}/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: msgText })
              })
              .then(r => r.json())
              .then(data => {
                if (data.ok) {
                  onSent?.()
                  setMessages(prev => [...prev, { role: 'claude', type: 'text', content: '✓ Sent to Instagram' }])
                } else {
                  setMessages(prev => [...prev, { role: 'claude', type: 'text', content: `❌ Error: ${JSON.stringify(data.error)}` }])
                }
              })
              .catch(e => {
                setMessages(prev => [...prev, { role: 'claude', type: 'text', content: `❌ ${e.message}` }])
              })
              .finally(() => setSending(false))
            }}
          >
            {sending ? '⏳ Sending...' : '✦ Confirm and send to Instagram'}
          </button>
        </div>
      )}

      {/* Input to Claude */}
      {tab === 'claude' && <div className="px-3 pb-3 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
        <div
          className="flex items-end gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
        >
          {/* Attach image */}
          <label
            title="Attach photo or screenshot"
            className="p-1 rounded-lg shrink-0 transition-colors"
            style={{ color: 'var(--muted-foreground)', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted-foreground)')}
          >
            <input type="file" accept="image/*" className="hidden" onChange={e => {
              const file = e.target.files?.[0]
              if (!file) return
              setMessages(prev => [...prev, {
                role: 'user', type: 'text',
                content: `📎 ${file.name}`
              }, {
                role: 'claude', type: 'text',
                content: 'Image received. Vision API — coming in Phase 3'
              }])
            }} />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </label>

          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Claude to revise..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs outline-none leading-relaxed"
            style={{ color: 'var(--foreground)' }}
            onInput={e => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = Math.min(t.scrollHeight, 80) + 'px'
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            onPaste={e => {
              const items = Array.from(e.clipboardData.items)
              const imageItem = items.find(i => i.type.startsWith('image/'))
              if (!imageItem) return
              e.preventDefault()
              const file = imageItem.getAsFile()
              if (!file) return
              const reader = new FileReader()
              reader.onload = ev => {
                const dataUrl = ev.target?.result as string
                setMessages(prev => [...prev,
                  { role: 'user', type: 'image' as any, content: dataUrl },
                  { role: 'claude', type: 'text', content: 'Screenshot received. Vision API — coming in Phase 3' }
                ])
              }
              reader.readAsDataURL(file)
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-1 rounded-lg disabled:opacity-30 transition-all shrink-0"
            style={{
              background: input.trim() ? 'var(--accent)' : 'transparent',
              color: input.trim() ? '#1a1610' : 'var(--muted-foreground)',
              cursor: input.trim() ? 'pointer' : 'default'
            }}
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-center mt-1" style={{ fontSize: 10, color: 'var(--muted-foreground)', opacity: 0.5 }}>
          Enter — send · Shift+Enter — new line
        </p>
      </div>}
    </div>
  )
}
