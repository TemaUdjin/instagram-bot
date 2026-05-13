import { useCallback, useEffect, useState } from 'react'
import Titlebar from './components/Titlebar'
import Inbox from './components/Inbox'
import Dialog from './components/Dialog'
import SuggestionsPanel from './components/SuggestionsPanel'
import ActivityBar from './components/ActivityBar'
import TabBar, { Tab } from './components/TabBar'
import ResizeHandle from './components/ResizeHandle'
import ReelsPanel from './components/ReelsPanel'
import CommentsThread from './components/CommentsThread'
import { api, MediaItem } from './api'
import StylePanel from './components/StylePanel'
import UnrepliedPanel from './components/UnrepliedPanel'

function PlaceholderPanel({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-2" style={{ borderColor: 'var(--border)' }}>
      <div className="text-3xl">{icon}</div>
      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</div>
      <div className="text-xs text-center px-4" style={{ color: 'var(--muted-foreground)' }}>{desc}</div>
      <div className="text-xs mt-2" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Coming soon</div>
    </div>
  )
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'hack'>(
    () => (localStorage.getItem('tp_theme') as 'dark' | 'hack') || 'hack'
  )
  const [activity, setActivity] = useState('inbox')
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [inboxWidth, setInboxWidth] = useState(240)
  const [claudeWidth, setClaudeWidth] = useState(300)
  const [serverOnline, setServerOnline] = useState(false)
  const [igRate, setIgRate] = useState<{ used: number; limit: number; minutesLeft: number } | null>(null)
  const [claudeTrigger, setClaudeTrigger] = useState<{ conversationId: string | null; messages: any[]; ts: number } | null>(null)
  const [dialogRefreshKey, setDialogRefreshKey] = useState(0)
  const [inboxRefreshKey, setInboxRefreshKey] = useState(0)
  const [lastSentText, setLastSentText] = useState<{ text: string; ts: number } | null>(null)
  const [prefillText, setPrefillText] = useState<{ text: string; ts: number } | null>(null)

  // Comments mode state
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [mediaList, setMediaList] = useState<MediaItem[]>([])

  const isCommentsMode = activity === 'comments'

  useEffect(() => {
    api.health()
      .then(h => { setServerOnline(h.ok && h.connected); if (h.igRate) setIgRate(h.igRate) })
      .catch(() => setServerOnline(false))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    document.documentElement.classList.toggle('hack', theme === 'hack')
  }, [theme])

  // Load media list when switching to comments mode
  useEffect(() => {
    if (activity === 'comments' && mediaList.length === 0) {
      api.media().then(setMediaList).catch(() => {})
    }
  }, [activity])

  const openTab = useCallback((id: string) => {
    setTabs(prev => {
      if (prev.find(t => t.id === id)) return prev
      return [...prev, { id, name: `...`, username: '' }]
    })
    setActiveTabId(id)
    api.messages(id)
      .then(detail => {
        const name = detail.profile.username || detail.profile.name || id.slice(-6)
        setTabs(prev => prev.map(t => t.id === id ? { ...t, name: `@${name}` } : t))
      })
      .catch(() => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, name: id.slice(-6) } : t))
      })
  }, [])

  const closeTab = (id: string) => {
    const remaining = tabs.filter(t => t.id !== id)
    setTabs(remaining)
    if (activeTabId === id) setActiveTabId(remaining.length > 0 ? remaining[remaining.length - 1].id : null)
  }

  const resizeInbox = useCallback((delta: number) => {
    setInboxWidth(w => Math.min(480, Math.max(160, w + delta)))
  }, [])

  const resizeClaude = useCallback((delta: number) => {
    setClaudeWidth(w => Math.min(600, Math.max(200, w - delta)))
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey

      if (meta && e.key === 'k') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')
        input?.focus()
      }

      if (!isCommentsMode) {
        if (meta && e.key === '[') {
          e.preventDefault()
          setActiveTabId(id => {
            const idx = tabs.findIndex(t => t.id === id)
            return idx > 0 ? tabs[idx - 1].id : id
          })
        }
        if (meta && e.key === ']') {
          e.preventDefault()
          setActiveTabId(id => {
            const idx = tabs.findIndex(t => t.id === id)
            return idx < tabs.length - 1 ? tabs[idx + 1].id : id
          })
        }
        if (meta && e.key === 'w' && activeTabId) {
          e.preventDefault()
          closeTab(activeTabId)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tabs, activeTabId, isCommentsMode])

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      <Titlebar theme={theme} onToggleTheme={() => setTheme(t => {
        const next = t === 'dark' ? 'hack' : 'dark'
        localStorage.setItem('tp_theme', next)
        return next
      })} />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar active={activity} onSelect={setActivity} />

        {/* Left panel */}
        <div style={{ width: inboxWidth, minWidth: inboxWidth, maxWidth: inboxWidth }}>
          {activity === 'inbox' && <Inbox activeId={activeTabId} onSelect={openTab} serverOnline={serverOnline} refreshKey={inboxRefreshKey} />}
          {activity === 'comments' && <ReelsPanel activeId={selectedMediaId} onSelect={setSelectedMediaId} />}
          {activity === 'unreplied' && <UnrepliedPanel igRate={igRate} onSelectPost={(id) => { setSelectedMediaId(id); setActivity('comments') }} />}
          {activity === 'clients' && <Inbox activeId={activeTabId} onSelect={openTab} serverOnline={serverOnline} refreshKey={inboxRefreshKey} defaultFilter="client" />}
          {activity === 'stats' && <PlaceholderPanel icon="📊" label="Stats" desc="Replies today, avg response time" />}
          {activity === 'style' && <StylePanel />}
          {activity === 'settings' && <PlaceholderPanel icon="⚙️" label="Settings" desc="API keys and configuration" />}
        </div>

        <ResizeHandle onResize={resizeInbox} />

        {/* Center */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ minWidth: 300 }}>
          {isCommentsMode ? (
            <CommentsThread mediaId={selectedMediaId} media={mediaList} />
          ) : (
            <>
              <TabBar tabs={tabs} activeId={activeTabId} onSelect={setActiveTabId} onClose={closeTab} />
              <Dialog
                conversationId={activeTabId}
                refreshKey={dialogRefreshKey}
                pendingSentText={lastSentText}
                prefillText={prefillText}
                serverOnline={serverOnline}
                onAskClaude={(messages) => {
                  setClaudeTrigger({ conversationId: activeTabId, messages, ts: Date.now() })
                }}
                onSent={() => setInboxRefreshKey(k => k + 1)}
              />
            </>
          )}
        </div>

        {/* Claude panel — hidden in comments mode (Claude is inline per comment) */}
        {!isCommentsMode && (
          <>
            <ResizeHandle onResize={resizeClaude} />
            <div style={{ width: claudeWidth, minWidth: claudeWidth, maxWidth: claudeWidth }}>
              <SuggestionsPanel
                conversationId={activeTabId}
                onSelect={(text) => {
                  setLastSentText({ text, ts: Date.now() })
                }}
                onSent={() => setInboxRefreshKey(k => k + 1)}
                onUseTemplate={(text) => setPrefillText({ text, ts: Date.now() })}
                trigger={claudeTrigger}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
