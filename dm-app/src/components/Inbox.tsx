import { useState, useEffect } from 'react'
import { api, ConversationSummary } from '../api'

export type ConversationStatus = 'new' | 'replied' | 'client' | 'ignored' | 'followup'

const MOCK: ConversationSummary[] = [
  { id: '1', name: 'Анна Петрова',   username: 'anna.petrova',  avatar: null, lastMessage: 'Хочу узнать про курс по гибкости...', waitMinutes: 2,    status: 'new',      unread: 2 },
  { id: '2', name: 'Михаил Козлов',  username: 'mkozlov',       avatar: null, lastMessage: 'Спасибо за ответ!',                  waitMinutes: 65,   status: 'replied',  unread: 0 },
  { id: '3', name: 'Ирина Соколова', username: 'irina.s',       avatar: null, lastMessage: 'Записалась на пробный урок',         waitMinutes: 180,  status: 'client',   unread: 0 },
  { id: '4', name: 'Дмитрий Орлов',  username: 'dmitry.orlov',  avatar: null, lastMessage: 'Окей понял',                         waitMinutes: 1440, status: 'followup', unread: 0 },
]

const STATUS_DOT: Record<ConversationStatus, string> = {
  new:      'var(--status-new)',
  replied:  'var(--status-replied)',
  client:   'var(--status-client)',
  ignored:  'var(--status-ignored)',
  followup: '#f59e0b',
}

function formatWait(m: number) {
  if (m < 60) return `${m}м`
  if (m < 1440) return `${Math.floor(m / 60)}ч`
  return `${Math.floor(m / 1440)}д`
}

function waitColor(m: number) {
  if (m > 120) return '#e05252'
  if (m > 30)  return 'var(--accent)'
  return 'var(--muted-foreground)'
}

interface InboxProps {
  activeId: string | null
  onSelect: (id: string) => void
  serverOnline: boolean
  refreshKey?: number
}

const HIDDEN_KEY = 'tp_hidden_convs'

export default function Inbox({ activeId, onSelect, serverOnline, refreshKey }: InboxProps) {
  const [all, setAll] = useState<ConversationSummary[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'new' | 'replied' | 'client'>('all')
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]')))
  const [showHidden, setShowHidden] = useState(false)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const hideConv = (id: string) => {
    const next = new Set(hidden)
    next.add(id)
    setHidden(next)
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
  }

  const restoreConv = (id: string) => {
    const next = new Set(hidden)
    next.delete(id)
    setHidden(next)
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...next]))
  }

  useEffect(() => {
    let cancelled = false
    const load = () => {
      setLoading(true)
      fetch('http://localhost:3001/api/conversations')
        .then(r => r.json())
        .then((data: ConversationSummary[]) => {
          if (!cancelled && Array.isArray(data)) setAll(data)
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    load()
    const interval = setInterval(load, 20000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [refreshKey])

  const active = all.filter(c => !hidden.has(c.id) && (c.waitMinutes < 1440 || c.status === 'client'))

  const counts = {
    all: active.length,
    new: active.filter(c => c.status === 'new').length,
    replied: active.filter(c => c.status === 'replied').length,
    client: active.filter(c => c.status === 'client').length,
  }

  const filtered = active
    .filter(c => filter === 'all' || c.status === filter)
    .filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.username.toLowerCase().includes(search.toLowerCase())
    )

  const FILTERS = [
    { id: 'all', label: 'Все' },
    { id: 'new', label: 'Новые' },
    { id: 'replied', label: 'Отвечено' },
    { id: 'client', label: 'Клиенты' },
  ] as const

  return (
    <div className="flex flex-col h-full border-r" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>

      {/* Filter tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex-1 py-2 text-xs font-medium transition-colors relative"
            style={{
              color: filter === f.id ? 'var(--foreground)' : 'var(--muted-foreground)',
              borderBottom: filter === f.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              cursor: 'pointer'
            }}
          >
            {f.label}
            {counts[f.id] > 0 && (
              <span className="ml-1" style={{ fontSize: 9, color: filter === f.id ? 'var(--accent)' : 'var(--muted-foreground)' }}>
                {counts[f.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="px-4 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Входящие</span>
            {!serverOnline && (
              <span style={{ fontSize: 9, color: 'var(--accent)', background: 'var(--muted)', padding: '1px 5px', borderRadius: 4 }}>демо</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {loading && <span style={{ fontSize: 10, color: 'var(--muted-foreground)' }}>↻</span>}
            {counts.new > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: 'var(--accent)', color: '#1a1610' }}>
                {counts.new}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--muted-foreground)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск... (⌘K)"
            className="flex-1 bg-transparent outline-none"
            style={{ fontSize: 11, color: 'var(--foreground)' }}
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading && all.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Загрузка...</span>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32">
            <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Нет активных диалогов</span>
          </div>
        )}
        {filtered.map(conv => (
          <button
            key={conv.id}
            onClick={() => onSelect(conv.id)}
            className="w-full text-left px-3 py-2.5 transition-colors"
            style={{ background: activeId === conv.id ? 'var(--muted)' : 'transparent', cursor: 'pointer' }}
            onMouseEnter={e => { setHoverId(conv.id); if (activeId !== conv.id) (e.currentTarget as HTMLElement).style.background = 'var(--muted)' }}
            onMouseLeave={e => { setHoverId(null); if (activeId !== conv.id) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            <div className="flex items-start gap-2.5">
              {/* Avatar — real or initial */}
              {conv.avatar
                ? <img src={conv.avatar} className="w-8 h-8 rounded-full shrink-0 mt-0.5 object-cover" alt={conv.name} />
                : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5" style={{ background: 'var(--accent)', color: '#1a1610' }}>{conv.name[0]}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--foreground)' }}>{conv.name}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {hoverId === conv.id && (
                      <button
                        onClick={e => { e.stopPropagation(); hideConv(conv.id) }}
                        title="Скрыть диалог"
                        className="rounded px-1.5 py-0.5 text-xs transition-colors"
                        style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'pointer' }}
                      >
                        скрыть
                      </button>
                    )}
                    <span className="text-xs font-medium" style={{ color: waitColor(conv.waitMinutes) }}>
                      {formatWait(conv.waitMinutes)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STATUS_DOT[conv.status as ConversationStatus] || 'var(--muted-foreground)' }} />
                  <span className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>
                    {conv.status === 'followup' ? '🔔 Follow-up' : conv.lastMessage}
                  </span>
                  {conv.unread > 0 && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0" style={{ background: 'var(--accent)', color: '#1a1610' }}>
                      {conv.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Hidden conversations panel */}
      {showHidden && hidden.size > 0 && (
        <div className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--muted)' }}>
          <div className="px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--muted-foreground)' }}>Скрытые</div>
          {all.filter(c => hidden.has(c.id)).map(conv => (
            <div key={conv.id} className="flex items-center gap-2 px-3 py-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'var(--border)', color: 'var(--muted-foreground)' }}>
                {conv.name[0]}
              </div>
              <span className="flex-1 text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{conv.name}</span>
              <button
                onClick={() => restoreConv(conv.id)}
                className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: 'var(--background)', color: 'var(--accent)', cursor: 'pointer', border: '1px solid var(--border)' }}
              >
                Вернуть
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-2 border-t flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {active.length} активных · {all.length} всего
        </span>
        <div className="flex items-center gap-2">
          {hidden.size > 0 && (
            <button
              onClick={() => setShowHidden(s => !s)}
              className="text-xs"
              style={{ color: 'var(--muted-foreground)', opacity: 0.6, cursor: 'pointer', background: 'none', border: 'none' }}
            >
              {showHidden ? 'Скрыть' : `скрытые (${hidden.size})`}
            </button>
          )}
          <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
            {loading ? '↻' : '● live'}
          </span>
        </div>
      </div>
    </div>
  )
}
