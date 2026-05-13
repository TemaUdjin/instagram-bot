import { useState, useRef, useEffect, useCallback } from 'react'
import { api, Comment } from '../api'
import EmojiButton from './EmojiButton'

function TranslateIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
      <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
    </svg>
  )
}

function MicIcon({ active }: { active?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  )
}

export interface CommentsClaudePanelProps {
  target: Comment | null
  postCaption: string
  onClose: () => void
  onUseSuggestion: (text: string, commentId: string) => void
}

export default function CommentsClaudePanel({ target, postCaption, onClose, onUseSuggestion }: CommentsClaudePanelProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionTranslations, setSuggestionTranslations] = useState<(string | null)[]>([])
  const [translatingIdx, setTranslatingIdx] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [usedIndex, setUsedIndex] = useState<number | null>(null)
  const [showEmoji, setShowEmoji] = useState(false)
  const [contextTranslation, setContextTranslation] = useState<string | null>(null)
  const [translatingContext, setTranslatingContext] = useState(false)
  const recognitionRef = useRef<any>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const insertEmoji = useCallback((emoji: string) => {
    const el = inputRef.current
    if (!el) { setInput(t => t + emoji); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newText = input.slice(0, start) + emoji + input.slice(end)
    setInput(newText)
    setTimeout(() => { el.focus(); el.setSelectionRange(start + emoji.length, start + emoji.length) }, 0)
  }, [input])

  useEffect(() => {
    setSuggestions([])
    setSuggestionTranslations([])
    setUsedIndex(null)
    setInput('')
    setContextTranslation(null)
  }, [target?.id])

  const handleTranslateContext = async () => {
    if (contextTranslation !== null) { setContextTranslation(null); return }
    if (!target?.text) return
    setTranslatingContext(true)
    try {
      const d = await api.translate(target.text)
      setContextTranslation(d.translation)
    } catch {
      setContextTranslation(null)
    } finally {
      setTranslatingContext(false)
    }
  }

  const handleTranslateSuggestion = async (idx: number) => {
    if (suggestionTranslations[idx] != null) {
      setSuggestionTranslations(prev => { const n = [...prev]; n[idx] = null; return n })
      return
    }
    setTranslatingIdx(idx)
    try {
      const d = await api.translate(suggestions[idx])
      setSuggestionTranslations(prev => { const n = [...prev]; n[idx] = d.translation; return n })
    } catch {
    } finally {
      setTranslatingIdx(null)
    }
  }

  const handleGenerate = async () => {
    if (!target) return
    setLoading(true)
    setSuggestions([])
    setSuggestionTranslations([])
    setUsedIndex(null)
    try {
      const commentWithContext = input.trim()
        ? `${target.text}\n\n[My rough idea: ${input.trim()}]`
        : target.text
      const data = await api.suggestCommentReply(postCaption, commentWithContext, target.username)
      const suggs = data.suggestions || []
      setSuggestions(suggs)
      setSuggestionTranslations(new Array(suggs.length).fill(null))
    } catch {
      setSuggestions(['Connection error'])
    } finally {
      setLoading(false)
    }
  }

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Voice input not available'); return }
    if (listening) { recognitionRef.current?.stop(); return }
    const rec = new SR()
    rec.lang = 'ru-RU'
    rec.continuous = false
    rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript
      setInput(prev => prev ? `${prev} ${t}` : t)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
    rec.start()
    recognitionRef.current = rec
  }

  const handleUse = (text: string, idx: number) => {
    if (!target) return
    setUsedIndex(idx)
    onUseSuggestion(text, target.id)
  }

  return (
    <div style={{ width: 260, minWidth: 260, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--card)' }}>
      {/* Header */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <span style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>✦ claude --comments</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}>
          <CloseIcon />
        </button>
      </div>

      {/* Context */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0, minHeight: 54 }}>
        {target ? (
          <>
            <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginBottom: 3, letterSpacing: '0.05em' }}>// context</div>
            <div style={{ fontSize: 11, color: 'var(--foreground)', opacity: 0.8, lineHeight: 1.4 }}>
              <span style={{ color: 'var(--accent)', opacity: 0.7 }}>@{target.username}</span>{' '}
              {target.text.length > 90 ? target.text.slice(0, 90) + '…' : target.text}
            </div>
            {contextTranslation && (
              <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4 }}>{contextTranslation}</div>
            )}
            <button
              onClick={handleTranslateContext}
              style={{ marginTop: 4, background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: contextTranslation ? 'var(--hack-comment-color, var(--accent))' : 'var(--muted-foreground)', opacity: translatingContext ? 0.5 : 1 }}
            >
              <TranslateIcon />{translatingContext ? '...' : contextTranslation ? 'hide' : 'translate'}
            </button>
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.5 }}>// click ✦ claude on a comment</div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginBottom: 6, letterSpacing: '0.05em' }}>// your take (optional)</div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--muted)' }}>
          <span style={{ color: 'var(--accent)', fontSize: 12, lineHeight: '18px', flexShrink: 0, opacity: 0.7 }}>{'>'}</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="rough idea, tone, anything..."
            rows={2}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 11, color: 'var(--foreground)', fontFamily: 'inherit', lineHeight: 1.5 }}
            onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleGenerate() } }}
          />
          <EmojiButton show={showEmoji} onToggle={() => setShowEmoji(v => !v)} onClose={() => setShowEmoji(false)} onSelect={insertEmoji} alignRight />
          <button
            onClick={startVoice}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: listening ? '#e05252' : 'var(--muted-foreground)', padding: 2, display: 'flex', flexShrink: 0, animation: listening ? 'terminal-blink 1s step-end infinite' : 'none' }}
          >
            <MicIcon active={listening} />
          </button>
        </div>
      </div>

      {/* Generate */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <button
          onClick={handleGenerate}
          disabled={loading || !target}
          style={{ width: '100%', padding: '6px 0', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, cursor: loading || !target ? 'default' : 'pointer', color: loading || !target ? 'var(--muted-foreground)' : 'var(--accent)', fontSize: 11, fontFamily: 'inherit', fontWeight: 600, letterSpacing: '0.04em', transition: 'border-color 0.15s' }}
          onMouseEnter={e => { if (!loading && target) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
        >
          {loading ? '[ thinking... ]' : '[ generate ]'}
        </button>
      </div>

      {/* Suggestions */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {suggestions.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginBottom: 8, letterSpacing: '0.05em' }}>// suggestions</div>
        )}
        {suggestions.map((s, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
            <button
              onClick={() => handleUse(s, i)}
              style={{ textAlign: 'left', fontSize: 11, lineHeight: 1.5, padding: '8px 10px', borderRadius: 10, background: usedIndex === i ? 'var(--card)' : 'var(--muted)', border: usedIndex === i ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', width: '100%' }}
            >
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: 'var(--accent)', fontWeight: 600, flexShrink: 0 }}>{usedIndex === i ? '✓' : i + 1}</span>
                <span style={{ color: 'var(--claude-text, var(--foreground))' }}>{s}</span>
              </div>
              {suggestionTranslations[i] && (
                <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: 4, paddingLeft: 18 }}>
                  {suggestionTranslations[i]}
                </div>
              )}
            </button>
            <button
              onClick={() => handleTranslateSuggestion(i)}
              style={{ background: 'none', border: 'none', padding: '0 4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: suggestionTranslations[i] ? 'var(--hack-comment-color, var(--accent))' : 'var(--muted-foreground)', opacity: translatingIdx === i ? 0.5 : 1, alignSelf: 'flex-start' }}
            >
              <TranslateIcon />{translatingIdx === i ? '...' : suggestionTranslations[i] ? 'hide' : 'translate'}
            </button>
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>thinking<span className="terminal-cursor" /></span>
          </div>
        )}
      </div>
    </div>
  )
}
