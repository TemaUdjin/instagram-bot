import { MoonIcon } from './Icons'

interface TitlebarProps {
  theme: 'dark' | 'hack'
  onToggleTheme: () => void
}

function TerminalIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/>
      <line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  )
}

async function startDrag() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().startDragging()
  } catch {}
}

export default function Titlebar({ theme, onToggleTheme }: TitlebarProps) {
  const isHack = theme === 'hack'

  return (
    <div
      data-tauri-drag-region
      onMouseDown={startDrag}
      className="titlebar flex items-center justify-between px-4 h-11 border-b shrink-0"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Left: traffic lights space + app name */}
      <div className="flex items-center gap-3 pl-16">
        <span className="flex items-center">
          <span
            className="app-title text-sm font-medium tracking-wide"
            style={{ color: 'var(--muted-foreground)' }}
          >
            Toward Perfection
          </span>
          {isHack && <span className="terminal-cursor" />}
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--muted)',
            color: 'var(--accent)',
            fontWeight: 500,
            fontFamily: isHack ? 'monospace' : undefined,
            letterSpacing: isHack ? '0.05em' : undefined,
          }}
        >
          {isHack ? '_DM' : 'DM'}
        </span>
      </div>

      {/* Right: theme toggle */}
      <button
        onClick={onToggleTheme}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors cursor-pointer text-xs"
        style={{
          color: 'var(--muted-foreground)',
          fontFamily: isHack ? 'monospace' : undefined,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'var(--muted)'
          e.currentTarget.style.color = 'var(--accent)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--muted-foreground)'
        }}
        title={isHack ? 'Dark mode' : 'Hack mode'}
      >
        {isHack ? (
          <>
            <MoonIcon />
            <span style={{ fontSize: 10, opacity: 0.7 }}>normal</span>
          </>
        ) : (
          <>
            <TerminalIcon />
            <span style={{ fontSize: 10, opacity: 0.7 }}>hack</span>
          </>
        )}
      </button>
    </div>
  )
}
