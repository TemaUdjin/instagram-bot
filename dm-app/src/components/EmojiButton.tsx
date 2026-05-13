import { useEffect, useRef } from 'react'

export const DM_EMOJIS = ['🫡','😌','🙃','😄','🤝🏼','💪🏼','🙏🏼','😁','😅','⚡️','🔥','🤍','🩶','💛']

function EmojiPicker({ onSelect, onClose, alignRight }: { onSelect: (e: string) => void; onClose: () => void; alignRight?: boolean }) {
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
      className="absolute bottom-full mb-2 z-50 flex flex-wrap p-2 rounded-lg"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        gap: 4,
        width: 216,
        ...(alignRight ? { right: 0 } : { left: 0 }),
      }}
    >
      {DM_EMOJIS.map(emoji => (
        <button
          key={emoji}
          onClick={() => { onSelect(emoji); onClose() }}
          className="flex items-center justify-center rounded transition-all"
          style={{ width: 28, height: 28, fontSize: 16, background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

interface EmojiButtonProps {
  show: boolean
  onToggle: () => void
  onClose: () => void
  onSelect: (emoji: string) => void
  alignRight?: boolean
}

export default function EmojiButton({ show, onToggle, onClose, onSelect, alignRight }: EmojiButtonProps) {
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {show && <EmojiPicker onSelect={onSelect} onClose={onClose} alignRight={alignRight} />}
      <button
        onClick={onToggle}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          color: show ? 'var(--accent)' : 'var(--muted-foreground)',
          fontSize: 12, fontFamily: 'inherit', fontWeight: 600, lineHeight: 1,
          letterSpacing: '-0.5px',
        }}
        title="Emoji"
      >
        =)
      </button>
    </div>
  )
}
