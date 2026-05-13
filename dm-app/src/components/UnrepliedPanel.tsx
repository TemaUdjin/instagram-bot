import { useState, useCallback, useEffect } from 'react'
import { api, Comment, MediaItem } from '../api'
import EmojiButton from './EmojiButton'
import CommentsClaudePanel from './CommentsClaudePanel'

const OWN_USERNAME = 'temayujin'
const FETCH_DELAY_MS = 350
const OWN_IDS_KEY = 'tp_own_comment_ids'
const HIDDEN_KEY = 'tp_hidden_unreplied'

function loadOwnIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(OWN_IDS_KEY) || '[]')) }
  catch { return new Set() }
}

function loadHiddenIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')) }
  catch { return new Set() }
}

function persistHideId(id: string) {
  try {
    const ids = loadHiddenIds()
    ids.add(id)
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]))
  } catch {}
}

interface IgRate { used: number; limit: number; minutesLeft: number }

interface UnrepliedComment {
  comment: Comment
  post: MediaItem
  replied?: boolean  // marked after sending reply
  hidden?: boolean   // manually hidden
}

// Module-level cache — survives tab switches, resets only on [ load ]
let cachedItems: UnrepliedComment[] = []
let cacheLoaded = false

function saveOwnId(id: string) {
  try {
    const ids = loadOwnIds()
    ids.add(id)
    localStorage.setItem(OWN_IDS_KEY, JSON.stringify([...ids].slice(-500)))
  } catch {}
}

function RateBar({ rate }: { rate: IgRate | null }) {
  if (!rate) return null
  const pct = Math.min(100, Math.round((rate.used / rate.limit) * 100))
  const color = pct >= 70 ? '#e05252' : pct >= 30 ? 'var(--accent)' : 'var(--status-client)'
  const label = pct >= 70 ? 'slow down' : pct >= 30 ? 'moderate' : 'safe'
  return (
    <div style={{ padding: '6px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))', letterSpacing: '0.04em' }}>
          // instagram api
        </span>
        <span style={{ fontSize: 10, color }}>
          {rate.used} / {rate.limit} · {pct}% · {label}
        </span>
      </div>
      <div style={{ height: 3, background: 'var(--muted)', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width 0.4s' }} />
      </div>
      {pct >= 70 && (
        <div style={{ fontSize: 10, color: '#e05252', marginTop: 4 }}>
          resets in {rate.minutesLeft}m — wait before refreshing
        </div>
      )}
    </div>
  )
}

function ReplyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
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

interface CommentItemProps {
  item: UnrepliedComment
  onReplied: (commentId: string) => void
  onHide: (commentId: string) => void
  onOpenClaude: (comment: Comment, post: MediaItem) => void
  prefillText?: string
}

function CommentItem({ item, onReplied, onHide, onOpenClaude, prefillText }: CommentItemProps) {
  const { comment, post, replied } = item
  const [replyText, setReplyText] = useState('')
  const [replyOpen, setReplyOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showEmoji, setShowEmoji] = useState(false)

  // Prefill from Claude panel
  useEffect(() => {
    if (prefillText) { setReplyText(prefillText); setReplyOpen(true) }
  }, [prefillText])

  const insertEmoji = useCallback((emoji: string) => {
    setReplyText(t => t + emoji)
  }, [])

  const handleSend = async () => {
    if (!replyText.trim() || sending) return
    setSending(true)
    try {
      const result = await api.replyToComment(post.id, replyText.trim(), comment.id, comment.username || undefined)
      if (result.id) saveOwnId(result.id)
      onReplied(comment.id)
      setReplyOpen(false)
    } catch {
      setSending(false)
    }
  }

  const handleAskClaude = async () => {
    setLoadingSuggestions(true)
    setSuggestions([])
    try {
      const data = await api.suggestCommentReply(post.caption || '', comment.text, comment.username)
      setSuggestions(data.suggestions || [])
    } catch {
      setSuggestions(['Connection error'])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: '1px solid var(--border)',
      background: replied ? 'rgba(200, 169, 110, 0.07)' : 'transparent',
      borderLeft: replied ? '2px solid var(--accent)' : '2px solid transparent',
      transition: 'background 0.3s',
    }}>
      {/* Comment */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div
          style={{
            width: 28, height: 28, borderRadius: '50%', background: 'var(--muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)', flexShrink: 0
          }}
        >
          {comment.username ? comment.username[0].toUpperCase() : '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 2 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--msg-username, var(--foreground))' }}>
              @{comment.username || 'user'}
            </span>
            <span style={{ fontSize: 10, color: 'var(--hack-comment-color, var(--muted-foreground))' }}>
              {formatTime(comment.timestamp)}
            </span>
            {replied && (
              <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>✓ replied</span>
            )}
          </div>
          <p style={{ fontSize: 12, color: 'var(--foreground)', lineHeight: 1.4, margin: 0, opacity: replied ? 0.6 : 1 }}>{comment.text}</p>
        </div>
      </div>

      {/* Actions */}
      {!replyOpen ? (
        <div style={{ display: 'flex', gap: 10, paddingLeft: 36 }}>
          {!replied && (
            <>
              <button
                onClick={() => setReplyOpen(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 11, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <ReplyIcon /> reply
              </button>
              <button
                onClick={() => onOpenClaude(comment, post)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 11, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
              >
                <SparkleIcon /> claude
              </button>
            </>
          )}
          <button
            onClick={() => onHide(comment.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 11, padding: 0, opacity: 0.5 }}
          >
            hide
          </button>
        </div>
      ) : (
        <div style={{ paddingLeft: 36 }}>
          {suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setReplyText(s)}
                  style={{
                    textAlign: 'left', fontSize: 11, padding: '6px 10px', borderRadius: 8,
                    background: replyText === s ? 'var(--card)' : 'var(--muted)',
                    border: replyText === s ? '1px solid var(--accent)' : '1px solid var(--border)',
                    color: 'var(--claude-text, var(--foreground))', cursor: 'pointer', lineHeight: 1.4
                  }}
                >
                  <span style={{ color: 'var(--accent)', fontWeight: 600, marginRight: 6 }}>{i + 1}</span>{s}
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, padding: '6px 10px', borderRadius: 10, background: 'var(--muted)', border: '1px solid var(--border)' }}>
            <EmojiButton show={showEmoji} onToggle={() => setShowEmoji(v => !v)} onClose={() => setShowEmoji(false)} onSelect={insertEmoji} />
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={comment.username ? `Reply @${comment.username}...` : 'Write a reply...'}
              rows={1}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none', fontSize: 12, color: 'var(--foreground)', fontFamily: 'inherit', lineHeight: 1.5 }}
              onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 80) + 'px' }}
              onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); handleSend() } }}
            />
            <button
              onClick={handleSend}
              disabled={!replyText.trim() || sending}
              style={{
                background: replyText.trim() ? 'var(--accent)' : 'transparent',
                color: replyText.trim() ? '#1a1610' : 'var(--muted-foreground)',
                border: 'none', cursor: replyText.trim() ? 'pointer' : 'default',
                padding: 6, borderRadius: 6, display: 'flex', flexShrink: 0, opacity: sending ? 0.5 : 1
              }}
            >
              <SendIcon />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <button
              onClick={handleAskClaude}
              disabled={loadingSuggestions}
              style={{
                flex: 1, padding: '5px 0', background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 4, cursor: loadingSuggestions ? 'default' : 'pointer',
                color: loadingSuggestions ? 'var(--muted-foreground)' : 'var(--accent)',
                fontSize: 10, fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4
              }}
            >
              <SparkleIcon /> {loadingSuggestions ? 'thinking...' : '[ ask claude ]'}
            </button>
            <button
              onClick={() => { setReplyOpen(false); setSuggestions([]) }}
              style={{ padding: '5px 8px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--muted-foreground)', fontSize: 10, fontFamily: 'inherit' }}
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

interface UnrepliedPanelProps {
  onSelectPost: (mediaId: string) => void
  igRate: IgRate | null
}

export default function UnrepliedPanel({ onSelectPost, igRate }: UnrepliedPanelProps) {
  // Init from module-level cache so state survives tab switches
  const [items, setItems] = useState<UnrepliedComment[]>(() => cachedItems)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(cacheLoaded)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [claudeOpen, setClaudeOpen] = useState(false)
  const [claudeTarget, setClaudeTarget] = useState<{ comment: Comment; post: MediaItem } | null>(null)
  const [prefillFor, setPrefillFor] = useState<{ commentId: string; text: string } | null>(null)

  const isBlocked = igRate && (igRate.used / igRate.limit) >= 0.7

  const loadUnreplied = async () => {
    if (loading || isBlocked) return
    setLoading(true)
    setLoaded(false)
    cachedItems = []
    setItems([])

    const ownIds = loadOwnIds()
    const hiddenIds = loadHiddenIds()

    try {
      const media = await api.media()
      const withComments = media.filter(m => m.commentsCount > 0)
      setProgress({ done: 0, total: withComments.length })

      const result: UnrepliedComment[] = []

      for (let i = 0; i < withComments.length; i++) {
        const post = withComments[i]
        try {
          const comments = await api.comments(post.id)
          for (const c of comments) {
            // Skip own or previously hidden comments
            if (c.isOwn || c.username === OWN_USERNAME || ownIds.has(c.id) || hiddenIds.has(c.id)) continue
            // Check if any reply is from us (username, isOwn flag, or localStorage ID)
            const hasOwnReply = c.replies.some(
              r => r.isOwn || r.username === OWN_USERNAME || ownIds.has(r.id)
            )
            if (!hasOwnReply) {
              result.push({ comment: c, post })
            }
          }
          setProgress({ done: i + 1, total: withComments.length })
          cachedItems = [...result]
          setItems([...result])
        } catch {
          // skip failed post
        }
        if (i < withComments.length - 1) {
          await new Promise(r => setTimeout(r, FETCH_DELAY_MS))
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
      cacheLoaded = true
      setLoaded(true)
    }
  }

  const handleReplied = (commentId: string) => {
    setItems(prev => {
      const next = prev.map(i => i.comment.id === commentId ? { ...i, replied: true } : i)
      cachedItems = next
      return next
    })
  }

  const handleHide = (commentId: string) => {
    persistHideId(commentId)
    setItems(prev => {
      const next = prev.filter(i => i.comment.id !== commentId)
      cachedItems = next
      return next
    })
  }

  const handleOpenClaude = (comment: Comment, post: MediaItem) => {
    setClaudeTarget({ comment, post })
    setClaudeOpen(true)
  }

  const handleUseSuggestion = (text: string, commentId: string) => {
    setPrefillFor({ commentId, text })
    setClaudeOpen(false)
  }

  const unrepliedCount = items.filter(i => !i.replied).length

  // Group by post (exclude hidden)
  const grouped = items
    .filter(i => !i.hidden)
    .reduce((acc, item) => {
      const key = item.post.id
      if (!acc[key]) acc[key] = { post: item.post, comments: [] }
      acc[key].comments.push(item)
      return acc
    }, {} as Record<string, { post: MediaItem; comments: UnrepliedComment[] }>)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', background: 'var(--background)' }}>
    {/* Feed */}
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--foreground)' }}>
            New Comments
            {loaded && items.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, color: unrepliedCount > 0 ? 'var(--accent)' : 'var(--status-client)', fontWeight: 400 }}>
                {unrepliedCount > 0 ? unrepliedCount : '✓ all replied'}
              </span>
            )}
          </span>
          <button
            onClick={loadUnreplied}
            disabled={loading || !!isBlocked}
            style={{
              fontSize: 10, fontFamily: 'inherit', fontWeight: 600,
              background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
              padding: '3px 8px', cursor: loading || isBlocked ? 'default' : 'pointer',
              color: isBlocked ? '#e05252' : loading ? 'var(--muted-foreground)' : 'var(--accent)',
            }}
          >
            {isBlocked ? '[ blocked ]' : loading ? `[ ${progress.done}/${progress.total} ]` : '[ load ]'}
          </button>
        </div>
      </div>

      {/* Rate bar */}
      <RateBar rate={igRate} />

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!loaded && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ opacity: 0.3 }}>
              <circle cx="40" cy="40" r="37" stroke="var(--accent)" strokeWidth="1.5"/>
              <polygon points="40,15 62,53 18,53" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 11, color: 'var(--hack-comment-color, var(--muted-foreground))' }}>// press [ load ] to scan</span>
          </div>
        )}

        {loading && items.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
              scanning posts... {progress.done}/{progress.total}
            </span>
          </div>
        )}

        {loaded && items.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%' }}>
            <span style={{ fontSize: 11, color: 'var(--hack-comment-color, var(--muted-foreground))' }}>// all caught up</span>
          </div>
        )}

        {Object.values(grouped).map(({ post, comments }) => (
          <div key={post.id}>
            {/* Post header */}
            <button
              onClick={() => onSelectPost(post.id)}
              style={{
                width: '100%', padding: '6px 12px', textAlign: 'left',
                background: 'var(--card)', border: 'none', borderBottom: '1px solid var(--border)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
              }}
            >
              {post.thumbnail && (
                <img src={post.thumbnail} alt="" style={{ width: 24, height: 24, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
              )}
              <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {post.caption?.slice(0, 60) || 'Post'}
              </span>
              <span style={{ fontSize: 10, color: 'var(--accent)', flexShrink: 0 }}>{comments.length}</span>
            </button>

            {comments.map(item => (
              <CommentItem
                key={item.comment.id}
                item={item}
                onReplied={handleReplied}
                onHide={handleHide}
                onOpenClaude={handleOpenClaude}
                prefillText={prefillFor?.commentId === item.comment.id ? prefillFor.text : undefined}
              />
            ))}
          </div>
        ))}
      </div>
    </div>

    {/* Claude panel */}
    {claudeOpen && (
      <CommentsClaudePanel
        target={claudeTarget?.comment ?? null}
        postCaption={claudeTarget?.post.caption || ''}
        onClose={() => setClaudeOpen(false)}
        onUseSuggestion={handleUseSuggestion}
      />
    )}
    </div>
  )
}
