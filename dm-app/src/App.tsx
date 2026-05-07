import { useCallback, useEffect, useState } from 'react'
import Titlebar from './components/Titlebar'
import Inbox from './components/Inbox'
import Dialog from './components/Dialog'
import SuggestionsPanel from './components/SuggestionsPanel'
import ActivityBar from './components/ActivityBar'
import TabBar, { Tab } from './components/TabBar'
import ResizeHandle from './components/ResizeHandle'
import { api } from './api'
import StylePanel from './components/StylePanel'

function PlaceholderPanel({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-2" style={{ borderColor: 'var(--border)' }}>
      <div className="text-3xl">{icon}</div>
      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{label}</div>
      <div className="text-xs text-center px-4" style={{ color: 'var(--muted-foreground)' }}>{desc}</div>
      <div className="text-xs mt-2" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>Скоро</div>
    </div>
  )
}

export default function App() {
  const [dark, setDark] = useState(true)
  const [activity, setActivity] = useState('inbox')
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [inboxWidth, setInboxWidth] = useState(240)
  const [claudeWidth, setClaudeWidth] = useState(300)
  const [serverOnline, setServerOnline] = useState(false)
  const [claudeTrigger, setClaudeTrigger] = useState<{ conversationId: string | null; messages: any[]; ts: number } | null>(null)
  const [dialogRefreshKey, setDialogRefreshKey] = useState(0)
  const [inboxRefreshKey, setInboxRefreshKey] = useState(0)
  const [lastSentText, setLastSentText] = useState<{ text: string; ts: number } | null>(null)
  const [prefillText, setPrefillText] = useState<{ text: string; ts: number } | null>(null)

  // Check server health on mount
  useEffect(() => {
    api.health()
      .then(h => setServerOnline(h.ok && h.connected))
      .catch(() => setServerOnline(false))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  const openTab = useCallback((id: string) => {
    setTabs(prev => {
      if (prev.find(t => t.id === id)) return prev
      return [...prev, { id, name: `...`, username: '' }]
    })
    setActiveTabId(id)
    // Load real name from API and update tab
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

      // ⌘K — focus search in inbox
      if (meta && e.key === 'k') {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Поиск"]')
        input?.focus()
      }

      // ⌘[ and ⌘] — switch tabs
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

      // ⌘W — close current tab
      if (meta && e.key === 'w' && activeTabId) {
        e.preventDefault()
        closeTab(activeTabId)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tabs, activeTabId])

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
      <Titlebar dark={dark} onToggleTheme={() => setDark(d => !d)} />

      <div className="flex flex-1 overflow-hidden">
        <ActivityBar active={activity} onSelect={setActivity} />

        {/* Left panel */}
        <div style={{ width: inboxWidth, minWidth: inboxWidth, maxWidth: inboxWidth }}>
          {activity === 'inbox' && <Inbox activeId={activeTabId} onSelect={openTab} serverOnline={serverOnline} refreshKey={inboxRefreshKey} />}
          {activity === 'clients' && <PlaceholderPanel icon="⭐" label="Клиенты" desc="Контакты со статусом «Клиент»" />}
          {activity === 'stats' && <PlaceholderPanel icon="📊" label="Статистика" desc="Ответов сегодня, среднее время" />}
          {activity === 'style' && <StylePanel />}
          {activity === 'settings' && <PlaceholderPanel icon="⚙️" label="Настройки" desc="API ключи и параметры" />}
        </div>

        <ResizeHandle onResize={resizeInbox} />

        {/* Center: tabs + dialog */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0" style={{ minWidth: 300 }}>
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
        </div>

        <ResizeHandle onResize={resizeClaude} />

        {/* Claude panel */}
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
      </div>
    </div>
  )
}
