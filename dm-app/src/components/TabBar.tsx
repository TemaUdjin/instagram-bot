export interface Tab {
  id: string
  name: string
  username: string
}

interface TabBarProps {
  tabs: Tab[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export default function TabBar({ tabs, activeId, onSelect, onClose }: TabBarProps) {
  if (tabs.length === 0) return (
    <div
      className="h-9 border-b flex items-center px-4"
      style={{ borderColor: 'var(--border)', background: 'var(--tabbar-bg)' }}
    >
      <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Open a conversation →
      </span>
    </div>
  )

  return (
    <div
      className="flex border-b overflow-x-auto"
      style={{ borderColor: 'var(--border)', background: 'var(--tabbar-bg)', minHeight: 36 }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeId
        return (
          <div
            key={tab.id}
            className="flex items-center gap-2 px-4 py-2 cursor-pointer shrink-0 group relative"
            style={{
              background: isActive ? 'var(--background)' : 'transparent',
              borderRight: '1px solid var(--border)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1
            }}
            onClick={() => onSelect(tab.id)}
          >
            <span
              className="text-xs font-medium"
              style={{ color: isActive ? 'var(--person-name, var(--foreground))' : 'var(--muted-foreground)' }}
            >
              {tab.name}
            </span>
            <button
              className="opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5"
              style={{ color: 'var(--muted-foreground)' }}
              onClick={(e) => { e.stopPropagation(); onClose(tab.id) }}
            >
              <CloseIcon />
            </button>
          </div>
        )
      })}
    </div>
  )
}
