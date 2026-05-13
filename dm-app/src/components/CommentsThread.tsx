import { useState, useEffect, useRef, useCallback } from 'react'
import { api, Comment, MediaItem } from '../api'

function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  )
}

function ReplyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

function TranslateIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/>
      <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
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

const EMOJIS = [
  '😊','😂','😅','🤔','😍','🙏','🔥','❤️','💪','👋',
  '👍','👏','🙌','💯','✨','🌟','💫','⚡','🎯','🏆',
  '😎','🤩','💥','🫶','🤝','👊','💡','🎉','🙂','😤',
]

const OWN_USERNAME = 'temayujin'

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute bottom-full mb-1 left-0 z-50 rounded-xl p-2 grid"
      style={{
        gridTemplateColumns: 'repeat(10, 1fr)',
        gap: 2,
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        width: 280,
      }}
    >
      {EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose() }}
          className="text-base rounded-lg flex items-center justify-center transition-all"
          style={{ width: 26, height: 26, cursor: 'pointer', background: 'none', border: 'none', fontSize: 16 }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.round((now.getTime() - d.getTime()) / 3600000)
  if (diffH < 1) return 'just now'
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString('en', { day: 'numeric', month: 'short' })
}

function Avatar({ username }: { username: string }) {
  const letter = username ? username[0].toUpperCase() : '?'
  const colors = ['#c8a96e', '#7eb8c8', '#c87e9a', '#7ec8a0', '#c8a07e', '#a07ec8']
  const color = username ? colors[letter.charCodeAt(0) % colors.length] : 'var(--muted)'
  return (
    <div
      className="rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ width: 32, height: 32, background: color, color: username ? '#1a1610' : 'var(--muted-foreground)' }}
    >
      {letter}
    </div>
  )
}

interface LocalReply {
  id: string
  text: string
  username: string
  timestamp: string
}

interface CommentRowProps {
  comment: Comment & { localReplies?: LocalReply[] }
  mediaId: string
  postCaption: string
  isReply?: boolean
  replyToCommentId?: string  // parent comment ID when this is a nested reply
  onDeleted?: (id: string) => void
  onReplySent?: (commentId: string, reply: LocalReply) => void
  onOpenClaude?: (comment: Comment) => void
  prefillText?: string
}

function CommentRow({ comment, mediaId, postCaption, isReply, replyToCommentId, onDeleted, onReplySent, onOpenClaude, prefillText }: CommentRowProps) {
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [translation, setTranslation] = useState<string | null>(null)
  const [translating, setTranslating] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isOwn = comment.username === OWN_USERNAME

  // When Claude panel sends a suggestion, pre-fill reply box
  useEffect(() => {
    if (prefillText) {
      setReplyText(prefillText)
      setReplyOpen(true)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [prefillText])

  const allReplies = [
    ...(comment.replies || []),
    ...(comment.localReplies || []),
  ]

  const insertEmoji = useCallback((emoji: string) => {
    const el = textareaRef.current
    if (!el) { setReplyText(t => t + emoji); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const newText = replyText.slice(0, start) + emoji + replyText.slice(end)
    setReplyText(newText)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + emoji.length, start + emoji.length)
    }, 0)
  }, [replyText])

  const handleAskClaude = async () => {
    setLoadingSuggestions(true)
    setSuggestions([])
    try {
      const data = await api.suggestCommentReply(postCaption, comment.text, comment.username)
      setSuggestions(data.suggestions || [])
    } catch {
      setSuggestions(['Claude connection error'])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleSend = async (text: string) => {
    if (!text.trim() || sending) return
    setSending(true)
    // For nested replies: send to parent thread, @mention this reply's author
    const targetId = replyToCommentId || comment.id
    const finalText = isReply && comment.username && !text.startsWith(`@${comment.username}`)
      ? `@${comment.username} ${text.trim()}`
      : text.trim()
    try {
      const result = await api.replyToComment(mediaId, finalText, targetId, undefined)
      const newReply: LocalReply = {
        id: result.id || `local_${Date.now()}`,
        text: finalText,
        username: OWN_USERNAME,
        timestamp: new Date().toISOString(),
      }
      onReplySent?.(targetId, newReply)
      setReplyText('')
      setSuggestions([])
      setReplyOpen(false)
    } catch {
      // keep open on error
    } finally {
      setSending(false)
    }
  }

  const handleDelete = async () => {
    if (deleting) return
    setDeleting(true)
    try {
      await api.deleteComment(comment.id)
      setDeleted(true)
      onDeleted?.(comment.id)
    } catch {
      setDeleting(false)
    }
  }

  const handleTranslate = async () => {
    if (translation !== null) { setTranslation(null); return }
    setTranslating(true)
    try {
      const data = await api.translate(comment.text)
      setTranslation(data.translation)
    } catch {
      setTranslation('Translation error')
    } finally {
      setTranslating(false)
    }
  }

  if (deleted) return null

  return (
    <div style={{ paddingLeft: isReply ? 44 : 0 }}>
      {isReply && (
        <div style={{
          position: 'absolute',
          left: 60,
          width: 1,
          top: 0,
          bottom: 0,
          background: 'var(--border)',
          opacity: 0.5,
        }} />
      )}
      <div
        className="px-4 py-3"
        style={{
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          ...(isOwn ? {
            borderLeft: '2px solid var(--hack-type)',
            background: 'rgba(78, 201, 176, 0.04)',
            paddingLeft: 14,
          } : {}),
        }}
      >
        <div className="flex gap-3">
          <Avatar username={comment.username} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              {comment.username ? (
                <span
                  className="text-xs font-semibold"
                  style={{ color: isOwn ? 'var(--hack-type)' : 'var(--msg-username, var(--foreground))' }}
                >
                  @{comment.username}
                  {isOwn && (
                    <span style={{ color: 'var(--hack-comment-color, var(--muted-foreground))', fontWeight: 400, marginLeft: 4 }}>
                      [you]
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
                  User
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--msg-time, var(--muted-foreground))' }}>
                {formatTime(comment.timestamp)}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {comment.text}
            </p>

            {/* Inline translation */}
            {translation !== null && (
              <p
                className="text-xs leading-relaxed"
                style={{
                  color: 'var(--hack-string, var(--muted-foreground))',
                  borderLeft: '2px solid var(--hack-string, var(--border))',
                  paddingLeft: 8,
                  marginTop: 6,
                  fontStyle: 'italic',
                  opacity: 0.85,
                }}
              >
                {translation}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-2">
              {comment.likeCount > 0 && (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted-foreground)' }}>
                  <HeartIcon filled={false} />
                  {comment.likeCount}
                </span>
              )}

              {!isOwn && (
                <button
                  onClick={handleTranslate}
                  className="flex items-center gap-1 text-xs transition-all"
                  style={{
                    color: translation !== null ? 'var(--hack-string, var(--accent))' : 'var(--muted-foreground)',
                    cursor: translating ? 'default' : 'pointer',
                    background: 'none', border: 'none', padding: 0,
                    opacity: translating ? 0.5 : 1,
                  }}
                >
                  <TranslateIcon />
                  {translating ? '...' : translation !== null ? 'hide' : 'translate'}
                </button>
              )}

              {!isOwn && (
                <button
                  onClick={() => { setReplyOpen(o => !o); setSuggestions([]) }}
                  className="flex items-center gap-1 text-xs transition-all"
                  style={{ color: replyOpen ? 'var(--accent)' : 'var(--muted-foreground)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                >
                  <ReplyIcon />
                  Reply
                </button>
              )}

              {!isReply && !isOwn && onOpenClaude && (
                <button
                  onClick={() => onOpenClaude(comment)}
                  className="flex items-center gap-1 text-xs transition-all"
                  style={{ color: 'var(--muted-foreground)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                  title="Open Claude panel for this comment"
                >
                  <SparkleIcon />
                  claude
                </button>
              )}

              {isOwn && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1 text-xs transition-all"
                  style={{ color: '#e05252', cursor: deleting ? 'default' : 'pointer', background: 'none', border: 'none', padding: 0, opacity: deleting ? 0.5 : 1 }}
                >
                  <TrashIcon />
                  {deleting ? '...' : 'Delete'}
                </button>
              )}
            </div>

            {/* Reply box */}
            {replyOpen && (
              <div className="mt-3 flex flex-col gap-2">
                {/* Mini-quote for nested replies */}
                {isReply && comment.username && (
                  <div
                    style={{
                      padding: '4px 8px',
                      borderLeft: '2px solid var(--hack-string, var(--border))',
                      background: 'rgba(206, 145, 120, 0.06)',
                      borderRadius: '0 3px 3px 0',
                    }}
                  >
                    <span style={{ fontSize: 10, color: 'var(--hack-string, var(--muted-foreground))', fontWeight: 600 }}>
                      ↩ @{comment.username}
                    </span>
                    <p style={{ fontSize: 10, color: 'var(--muted-foreground)', marginTop: 2, lineHeight: 1.4 }}>
                      {comment.text.length > 80 ? comment.text.slice(0, 80) + '…' : comment.text}
                    </p>
                  </div>
                )}

                {suggestions.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setReplyText(s)}
                        className="text-left text-xs leading-relaxed px-3 py-2 rounded-xl transition-all w-full"
                        style={{
                          background: replyText === s ? 'var(--card)' : 'var(--muted)',
                          border: replyText === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                          color: 'var(--foreground)',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ color: 'var(--accent)', fontWeight: 600, marginRight: 6 }}>{i + 1}</span>
                        {s}
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative">
                  {showEmoji && (
                    <EmojiPicker
                      onSelect={insertEmoji}
                      onClose={() => setShowEmoji(false)}
                    />
                  )}
                  <div
                    className="flex items-end gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                  >
                    <button
                      onClick={() => setShowEmoji(v => !v)}
                      className="text-base shrink-0 transition-all"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: showEmoji ? 'var(--accent)' : 'var(--muted-foreground)', padding: 0, lineHeight: 1 }}
                      title="Emoji"
                    >
                      🙂
                    </button>
                    <textarea
                      ref={textareaRef}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder={comment.username ? `Reply @${comment.username}...` : 'Write a reply...'}
                      rows={1}
                      className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
                      style={{ color: 'var(--foreground)' }}
                      onInput={e => {
                        const t = e.currentTarget
                        t.style.height = 'auto'
                        t.style.height = Math.min(t.scrollHeight, 100) + 'px'
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleSend(replyText) }
                      }}
                    />
                    <button
                      onClick={() => handleSend(replyText)}
                      disabled={!replyText.trim() || sending}
                      className="p-1.5 rounded-lg shrink-0 disabled:opacity-30 transition-all"
                      style={{
                        background: replyText.trim() ? 'var(--accent)' : 'transparent',
                        color: replyText.trim() ? '#1a1610' : 'var(--muted-foreground)',
                        cursor: replyText.trim() && !sending ? 'pointer' : 'default',
                        border: 'none'
                      }}
                    >
                      <SendIcon />
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAskClaude}
                  disabled={loadingSuggestions}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all w-full"
                  style={{
                    background: 'transparent',
                    color: loadingSuggestions ? 'var(--muted-foreground)' : 'var(--accent)',
                    border: '1px solid var(--border)',
                    cursor: loadingSuggestions ? 'default' : 'pointer'
                  }}
                >
                  <SparkleIcon />
                  {loadingSuggestions ? 'Thinking...' : '✦ Ask Claude'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      <div style={{ position: 'relative' }}>
        {allReplies.map(reply => (
          <CommentRow
            key={reply.id}
            comment={{ ...reply, likeCount: 0, replies: [] }}
            mediaId={mediaId}
            postCaption={postCaption}
            isReply
            replyToCommentId={comment.id}
            onDeleted={onDeleted}
            onReplySent={onReplySent}
          />
        ))}
      </div>
    </div>
  )
}

// Claude side panel for comments
interface ClaudePanelProps {
  target: Comment | null
  postCaption: string
  onClose: () => void
  onUseSuggestion: (text: string, commentId: string) => void
}

function CommentsClaudePanel({ target, postCaption, onClose, onUseSuggestion }: ClaudePanelProps) {
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionTranslations, setSuggestionTranslations] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [usedIndex, setUsedIndex] = useState<number | null>(null)
  const [contextTranslation, setContextTranslation] = useState<string | null>(null)
  const [translatingContext, setTranslatingContext] = useState(false)
  const recognitionRef = useRef<any>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-translate context comment when target changes
  useEffect(() => {
    setSuggestions([])
    setSuggestionTranslations([])
    setUsedIndex(null)
    setInput('')
    setContextTranslation(null)
    if (!target?.text) return
    setTranslatingContext(true)
    api.translate(target.text)
      .then(d => setContextTranslation(d.translation))
      .catch(() => setContextTranslation(null))
      .finally(() => setTranslatingContext(false))
  }, [target?.id])

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
      // Translate all suggestions in parallel
      Promise.all(suggs.map(s => api.translate(s).then(d => d.translation).catch(() => '')))
        .then(translations => setSuggestionTranslations(translations))
    } catch {
      setSuggestions(['Connection error'])
    } finally {
      setLoading(false)
    }
  }

  const startVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      alert('Voice input not available in this browser')
      return
    }
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const rec = new SR()
    rec.lang = 'ru-RU'
    rec.continuous = false
    rec.interimResults = false
    rec.onstart = () => setListening(true)
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setInput(prev => prev ? `${prev} ${transcript}` : transcript)
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
    <div
      style={{
        width: 260,
        minWidth: 260,
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--card)',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ color: 'var(--hack-keyword, var(--accent))', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>
          ✦ claude --comments
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 2, display: 'flex' }}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Target comment context */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          minHeight: 54,
        }}
      >
        {target ? (
          <>
            <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginBottom: 3, letterSpacing: '0.05em' }}>
              // context
            </div>
            <div style={{ fontSize: 11, color: 'var(--foreground)', opacity: 0.8, lineHeight: 1.4 }}>
              <span style={{ color: 'var(--accent)', opacity: 0.7 }}>@{target.username}</span>
              {' '}
              {target.text.length > 90 ? target.text.slice(0, 90) + '…' : target.text}
            </div>
            {(translatingContext || contextTranslation) && (
              <div style={{ fontSize: 10, color: 'var(--hack-string, var(--muted-foreground))', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4 }}>
                {translatingContext ? '...' : contextTranslation}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', opacity: 0.5 }}>
            // click ✦ claude on a comment
          </div>
        )}
      </div>

      {/* Input area */}
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginBottom: 6, letterSpacing: '0.05em' }}>
          // your take (optional)
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            padding: '6px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--muted)',
          }}
        >
          <span style={{ color: 'var(--accent)', fontSize: 12, lineHeight: '18px', flexShrink: 0, opacity: 0.7 }}>{'>'}</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="rough idea, tone, anything..."
            rows={2}
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: 11,
              color: 'var(--foreground)',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleGenerate() }
            }}
          />
          <button
            onClick={startVoice}
            title={listening ? 'Stop recording' : 'Voice input'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: listening ? '#e05252' : 'var(--muted-foreground)',
              padding: 2,
              display: 'flex',
              flexShrink: 0,
              animation: listening ? 'terminal-blink 1s step-end infinite' : 'none',
            }}
          >
            <MicIcon active={listening} />
          </button>
        </div>
      </div>

      {/* Generate button */}
      <div style={{ padding: '8px 12px', flexShrink: 0 }}>
        <button
          onClick={handleGenerate}
          disabled={loading || !target}
          style={{
            width: '100%',
            padding: '6px 0',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: 4,
            cursor: loading || !target ? 'default' : 'pointer',
            color: loading || !target ? 'var(--muted-foreground)' : 'var(--accent)',
            fontSize: 11,
            fontFamily: 'inherit',
            fontWeight: 600,
            letterSpacing: '0.04em',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => { if (!loading && target) (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}
        >
          {loading ? '[ thinking... ]' : '[ generate ]'}
        </button>
      </div>

      {/* Suggestions */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
        {suggestions.length > 0 && (
          <div style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', marginBottom: 8, letterSpacing: '0.05em' }}>
            // suggestions
          </div>
        )}
        {suggestions.map((s, i) => (
          <div
            key={i}
            style={{
              marginBottom: 8,
              padding: '8px 10px',
              border: usedIndex === i ? '1px solid var(--accent)' : '1px solid var(--border)',
              borderRadius: 4,
              background: usedIndex === i ? 'rgba(200, 169, 110, 0.08)' : 'var(--muted)',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onMouseEnter={e => { if (usedIndex !== i) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--muted-foreground)' }}
            onMouseLeave={e => { if (usedIndex !== i) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)' }}
            onClick={() => handleUse(s, i)}
          >
            <div style={{ fontSize: 10, color: usedIndex === i ? 'var(--hack-type, var(--accent))' : 'var(--hack-number, var(--muted-foreground))', marginBottom: 4, fontWeight: 600 }}>
              {usedIndex === i ? '✓ used' : `_${i + 1}`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--foreground)', lineHeight: 1.5 }}>{s}</div>
            {suggestionTranslations[i] && (
              <div style={{ fontSize: 10, color: 'var(--hack-string, var(--muted-foreground))', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4, borderTop: '1px solid var(--border)', paddingTop: 4 }}>
                {suggestionTranslations[i]}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              thinking<span className="terminal-cursor" />
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

interface CommentsThreadProps {
  mediaId: string | null
  media: MediaItem[]
}

export default function CommentsThread({ mediaId, media }: CommentsThreadProps) {
  const [comments, setComments] = useState<(Comment & { localReplies?: LocalReply[] })[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [claudeTarget, setClaudeTarget] = useState<Comment | null>(null)
  const [prefillFor, setPrefillFor] = useState<{ commentId: string; text: string; ts: number } | null>(null)

  const post = media.find(m => m.id === mediaId) || null

  useEffect(() => {
    if (!mediaId) { setComments([]); return }
    setLoading(true)
    api.comments(mediaId)
      .then(data => setComments(data.map(c => ({ ...c, localReplies: [] }))))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [mediaId, refreshKey])

  const handleReplySent = (commentId: string, reply: LocalReply) => {
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, localReplies: [...(c.localReplies || []), reply] }
        : c
    ))
  }

  const handleOpenClaude = (comment: Comment) => {
    setClaudeTarget(comment)
    setClaudeOpen(true)
  }

  const handleUseSuggestion = (text: string, commentId: string) => {
    setPrefillFor({ commentId, text, ts: Date.now() })
    setClaudeOpen(false)
  }

  if (!mediaId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Select a post</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-0" style={{ flex: 1, overflow: 'hidden', background: 'var(--background)' }}>

      {/* Post header */}
      {post && (
        <div
          className="px-4 py-3 border-b flex gap-3 items-start shrink-0"
          style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
        >
          {post.thumbnail && (
            <img
              src={post.thumbnail}
              alt=""
              className="rounded-lg object-cover shrink-0"
              style={{ width: 48, height: 48 }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: 'var(--foreground)' }}>
              {post.caption || 'No caption'}
            </p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
                {post.commentsCount} comments
              </span>
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className="text-xs"
                style={{ color: 'var(--accent)', opacity: 0.7, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                Refresh
              </button>
              <button
                onClick={() => setClaudeOpen(o => !o)}
                className="flex items-center gap-1 text-xs"
                style={{
                  color: claudeOpen ? 'var(--accent)' : 'var(--muted-foreground)',
                  cursor: 'pointer',
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  fontWeight: claudeOpen ? 600 : 400,
                }}
              >
                <SparkleIcon />
                {claudeOpen ? 'hide claude' : 'claude'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments + Claude panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* Comments scroll */}
        <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
          {loading && (
            <div className="flex items-center justify-center h-24">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Loading...</span>
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>No comments</p>
            </div>
          )}

          {!loading && comments.map(comment => (
            <CommentRow
              key={comment.id}
              comment={comment}
              mediaId={mediaId}
              postCaption={post?.caption || ''}
              onDeleted={(id) => setComments(prev => prev.filter(c => c.id !== id))}
              onReplySent={handleReplySent}
              onOpenClaude={handleOpenClaude}
              prefillText={prefillFor?.commentId === comment.id ? prefillFor.text : undefined}
            />
          ))}
        </div>

        {/* Claude panel */}
        {claudeOpen && (
          <CommentsClaudePanel
            target={claudeTarget}
            postCaption={post?.caption || ''}
            onClose={() => setClaudeOpen(false)}
            onUseSuggestion={handleUseSuggestion}
          />
        )}
      </div>
    </div>
  )
}
