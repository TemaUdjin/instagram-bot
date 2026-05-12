import { useState, useEffect, useRef } from 'react'
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

const OWN_USERNAME = 'temayujin'

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
    </svg>
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
  const color = username
    ? colors[letter.charCodeAt(0) % colors.length]
    : 'var(--muted)'
  return (
    <div
      className="rounded-full flex items-center justify-center text-xs font-bold shrink-0"
      style={{ width: 32, height: 32, background: color, color: username ? '#1a1610' : 'var(--muted-foreground)' }}
    >
      {letter}
    </div>
  )
}

interface CommentRowProps {
  comment: Comment
  mediaId: string
  postCaption: string
  isReply?: boolean
  onDeleted?: (id: string) => void
}

function CommentRow({ comment, mediaId, postCaption, isReply, onDeleted }: CommentRowProps) {
  const [liked, setLiked] = useState(comment.liked ?? false)
  const [likeCount, setLikeCount] = useState(comment.likeCount)
  const [likingInProgress, setLikingInProgress] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [sent, setSent] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isOwn = comment.username === OWN_USERNAME

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
      await api.replyToComment(mediaId, text.trim(), comment.id, comment.username || undefined)
      setReplyText('')
      setSuggestions([])
      setReplyOpen(false)
      setSent(true)
      setTimeout(() => setSent(false), 3000)
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
    <div style={{ paddingLeft: isReply ? 40 : 0 }}>
      <div
        className="px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex gap-3">
          <Avatar username={comment.username} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-semibold" style={{ color: 'var(--foreground)' }}>
                @{comment.username}
              </span>
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
                {likeCount > 0 && (
                  <span className="text-xs">{likeCount}</span>
                )}
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
                  style={{ color: deleting ? 'var(--muted-foreground)' : '#e05252', cursor: deleting ? 'default' : 'pointer', background: 'none', border: 'none', padding: 0, opacity: deleting ? 0.5 : 1 }}
                >
                  <TrashIcon />
                  {deleting ? '...' : 'Удалить'}
                </button>
              )}

              {sent && (
                <span className="text-xs" style={{ color: 'var(--status-client)' }}>✓ Отправлено</span>
              )}
            </div>

            {/* Reply box */}
            {replyOpen && (
              <div className="mt-3 flex flex-col gap-2">
                {/* Claude suggestions */}
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

                <div
                  className="flex items-end gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  <textarea
                    ref={textareaRef}
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder={`Ответить @${comment.username}...`}
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

                <button
                  onClick={handleAskClaude}
                  disabled={loadingSuggestions}
                  className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all w-full"
                  style={{
                    background: loadingSuggestions ? 'var(--muted)' : 'transparent',
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

      {/* Nested replies */}
      {comment.replies?.map(reply => (
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
  )
}

interface CommentsThreadProps {
  mediaId: string | null
  media: MediaItem[]
}

export default function CommentsThread({ mediaId, media }: CommentsThreadProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const post = media.find(m => m.id === mediaId) || null

  useEffect(() => {
    if (!mediaId) { setComments([]); return }
    setLoading(true)
    api.comments(mediaId)
      .then(data => setComments(data))
      .catch(() => setComments([]))
      .finally(() => setLoading(false))
  }, [mediaId, refreshKey])

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
                className="text-xs transition-all"
                style={{ color: 'var(--accent)', opacity: 0.7, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
              >
                Обновить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-24">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Загрузка...</span>
          </div>
        )}

        {!loading && comments.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
              Нет комментариев
            </p>
          </div>
        )}

        {!loading && comments.map(comment => (
          <CommentRow
            key={comment.id}
            comment={comment}
            mediaId={mediaId}
            postCaption={post?.caption || ''}
            onDeleted={(id) => setComments(prev => prev.filter(c => c.id !== id))}
          />
        ))}
      </div>
    </div>
  )
}
