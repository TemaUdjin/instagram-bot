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
  if (diffH < 1) return 'только что'
  if (diffH < 24) return `${diffH}ч назад`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}д назад`
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
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
  onDeleted?: (id: string) => void
  onReplySent?: (commentId: string, reply: LocalReply) => void
}

function CommentRow({ comment, mediaId, postCaption, isReply, onDeleted, onReplySent }: CommentRowProps) {
  const [liked, setLiked] = useState(comment.liked ?? false)
  const [likeCount, setLikeCount] = useState(comment.likeCount)
  const [likingInProgress, setLikingInProgress] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isOwn = comment.username === OWN_USERNAME

  const allReplies = [
    ...(comment.replies || []),
    ...(comment.localReplies || []),
  ]

  const handleLike = async () => {
    if (likingInProgress) return
    setLikingInProgress(true)
    const wasLiked = liked
    setLiked(!wasLiked)
    setLikeCount(c => wasLiked ? c - 1 : c + 1)
    try {
      if (wasLiked) await api.unlikeComment(comment.id)
      else await api.likeComment(comment.id)
    } catch {
      setLiked(wasLiked)
      setLikeCount(c => wasLiked ? c + 1 : c - 1)
    } finally {
      setLikingInProgress(false)
    }
  }

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
      setSuggestions(['Ошибка соединения с Claude'])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleSend = async (text: string) => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      const result = await api.replyToComment(mediaId, text.trim(), comment.id, comment.username || undefined)
      const newReply: LocalReply = {
        id: result.id || `local_${Date.now()}`,
        text: comment.username ? `@${comment.username} ${text.trim()}` : text.trim(),
        username: OWN_USERNAME,
        timestamp: new Date().toISOString(),
      }
      onReplySent?.(comment.id, newReply)
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
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', position: 'relative' }}>
        <div className="flex gap-3">
          <Avatar username={comment.username} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              {comment.username ? (
                <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                  @{comment.username}
                </span>
              ) : (
                <span className="text-xs font-semibold" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
                  Пользователь
                </span>
              )}
              <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
                {formatTime(comment.timestamp)}
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--foreground)' }}>
              {comment.text}
            </p>

            {/* Actions */}
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={handleLike}
                className="flex items-center gap-1 transition-all"
                style={{ color: liked ? '#e05252' : 'var(--muted-foreground)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                <HeartIcon filled={liked} />
                {likeCount > 0 && <span className="text-xs">{likeCount}</span>}
              </button>

              {!isReply && (
                <button
                  onClick={() => { setReplyOpen(o => !o); setSuggestions([]) }}
                  className="flex items-center gap-1 text-xs transition-all"
                  style={{ color: replyOpen ? 'var(--accent)' : 'var(--muted-foreground)', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                >
                  <ReplyIcon />
                  Ответить
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
                  {deleting ? '...' : 'Удалить'}
                </button>
              )}
            </div>

            {/* Reply box */}
            {replyOpen && (
              <div className="mt-3 flex flex-col gap-2">
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
                      title="Эмодзи"
                    >
                      🙂
                    </button>
                    <textarea
                      ref={textareaRef}
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                      placeholder={comment.username ? `Ответить @${comment.username}...` : 'Написать ответ...'}
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
                  {loadingSuggestions ? 'Думаю...' : '✦ Спросить Claude'}
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
            onDeleted={onDeleted}
          />
        ))}
      </div>
    </div>
  )
}

interface CommentsThreadProps {
  mediaId: string | null
  media: MediaItem[]
}

export default function CommentsThread({ mediaId, media }: CommentsThreadProps) {
  const [comments, setComments] = useState<(Comment & { localReplies?: { id: string; text: string; username: string; timestamp: string }[] })[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const post = media.find(m => m.id === mediaId) || null

  useEffect(() => {
    if (!mediaId) { setComments([]); return }
    setLoading(true)
    api.comments(mediaId)
      .then(data => setComments(data.map(c => ({ ...c, localReplies: [] }))))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [mediaId, refreshKey])

  const handleReplySent = (commentId: string, reply: { id: string; text: string; username: string; timestamp: string }) => {
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, localReplies: [...(c.localReplies || []), reply] }
        : c
    ))
  }

  if (!mediaId) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--background)' }}>
        <div className="text-center">
          <div className="text-4xl mb-3">🎬</div>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>Выбери пост слева</p>
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
              {post.caption || 'Без подписи'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
                {post.commentsCount} комментариев
              </span>
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className="text-xs"
                style={{ color: 'var(--accent)', opacity: 0.7, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                Обновить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-24">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Загрузка...</span>
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="flex items-center justify-center h-32">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>Нет комментариев</p>
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
          />
        ))}
      </div>
    </div>
  )
}
