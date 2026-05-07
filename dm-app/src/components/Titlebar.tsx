import { MoonIcon, SunIcon } from './Icons'

interface TitlebarProps {
  dark: boolean
  onToggleTheme: () => void
}

async function startDrag() {
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().startDragging()
  } catch {}
}

export default function Titlebar({ dark, onToggleTheme }: TitlebarProps) {
  return (
    <div
      data-tauri-drag-region
      onMouseDown={startDrag}
      className="titlebar flex items-center justify-between px-4 h-11 border-b shrink-0"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Left: traffic lights space (80px) + app name */}
      <div className="flex items-center gap-3 pl-16">
        <span
          className="text-sm font-medium tracking-wide"
          style={{ color: 'var(--muted-foreground)' }}
        >
          Toward Perfection
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--muted)',
            color: 'var(--accent)',
            fontWeight: 500
          }}
        >
          DM
        </span>
      </div>

      {/* Right: theme toggle */}
      <button
        onClick={onToggleTheme}
        className="p-1.5 rounded-md transition-colors cursor-pointer"
        style={{ color: 'var(--muted-foreground)' }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--muted)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--foreground)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--muted-foreground)'
        }}
        title={dark ? 'Светлая тема' : 'Тёмная тема'}
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  )
}
