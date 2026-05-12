import { useState, useEffect } from 'react'
import { api, MediaItem } from '../api'

function VideoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M8 5v14l11-7z"/>
    </svg>
  )
}

function ImageIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  )
}

function CommentBubbleIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.round((now.getTime() - d.getTime()) / 3600000)
  if (diffH < 1) return 'только что'
  if (diffH < 24) return `${diffH}ч`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `${diffD}д`
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' })
}

interface ReelsPanelProps {
  activeId: string | null
  onSelect: (id: string) => void
}

export default function ReelsPanel({ activeId, onSelect }: ReelsPanelProps) {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    api.media()
      .then(data => { setMedia(data); setError(null) })
      .catch(() => setError('Не удалось загрузить посты'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)', borderRight: '1px solid var(--border)' }}>

      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Посты и Reels</span>
        {!loading && (
          <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
            {media.length}
          </span>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-24">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>Загрузка...</span>
          </div>
        )}

        {error && (
          <div className="px-4 py-3">
            <span className="text-xs" style={{ color: '#e05252' }}>{error}</span>
          </div>
        )}

        {!loading && !error && media.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>Нет постов</span>
          </div>
        )}

        {!loading && media.map(item => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className="w-full text-left px-3 py-2.5 flex gap-3 items-start transition-all"
            style={{
              background: activeId === item.id ? 'var(--muted)' : 'transparent',
              borderLeft: activeId === item.id ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {/* Thumbnail */}
            <div
              className="rounded-lg shrink-0 flex items-center justify-center overflow-hidden"
              style={{ width: 48, height: 48, background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {item.thumbnail ? (
                <img
                  src={item.thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
              ) : (
                <span style={{ color: 'var(--muted-foreground)', opacity: 0.4 }}>
                  {item.type === 'VIDEO' ? <VideoIcon /> : <ImageIcon />}
                </span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 mb-0.5">
                <span style={{ color: 'var(--accent)', opacity: 0.7 }}>
                  {item.type === 'VIDEO' ? <VideoIcon /> : <ImageIcon />}
                </span>
                <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
                  {formatTime(item.timestamp)}
                </span>
              </div>
              <p
                className="text-xs leading-relaxed line-clamp-2"
                style={{ color: 'var(--foreground)', opacity: item.caption ? 1 : 0.35 }}
              >
                {item.caption || 'Без подписи'}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <span style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}><CommentBubbleIcon /></span>
                <span className="text-xs" style={{ color: item.commentsCount > 0 ? 'var(--accent)' : 'var(--muted-foreground)', fontWeight: item.commentsCount > 0 ? 600 : 400 }}>
                  {item.commentsCount}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
