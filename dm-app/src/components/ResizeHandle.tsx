import { useCallback, useEffect, useRef } from 'react'

interface ResizeHandleProps {
  onResize: (delta: number) => void
}

export default function ResizeHandle({ onResize }: ResizeHandleProps) {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    lastX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - lastX.current
      lastX.current = e.clientX
      onResize(delta)
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [onResize])

  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative flex items-center justify-center shrink-0"
      style={{ width: 5, cursor: 'col-resize', zIndex: 10 }}
    >
      {/* Invisible wide hit area */}
      <div style={{ position: 'absolute', inset: '0 -3px', cursor: 'col-resize' }} />
      {/* Visible line — glows on hover */}
      <div
        className="transition-all"
        style={{
          width: 1,
          height: '100%',
          background: 'var(--border)',
          transition: 'background 0.15s, width 0.15s'
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'var(--accent)'
          el.style.width = '2px'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLDivElement
          el.style.background = 'var(--border)'
          el.style.width = '1px'
        }}
      />
    </div>
  )
}
