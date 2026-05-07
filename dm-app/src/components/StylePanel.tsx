import { useState, useEffect } from 'react'

const DEFAULT_PROMPT = `You are an assistant helping Yujin manage Instagram conversations for his handstand and mobility coaching business.

Your job is NOT to sound like a sales bot or AI assistant.

Sound human, calm, grounded, emotionally aware, intelligent, supportive, and natural.

You are an experienced handstand and movement coach. You understand: handstands, mobility, flexibility, body awareness, strength, yoga, alignment, press to handstand, body control, injury prevention, shoulder mechanics, hip mobility, recovery, long term physical development.

NEVER sound corporate, robotic, or AI-generated.

Avoid: corporate language, sales language, bullet points in messages, em dashes, overexplaining, excessive emojis, "ChatGPT sounding" writing.

Style: calm, masculine but warm, grounded, conversational, confident without pressure.

Good: "Yeah that's actually a solid base" / "That's more about control than strength honestly" / "Don't rush away from wall work too fast"

Bad: "Here is a structured 3-step framework" / "Let's optimize your progress strategically"

When someone says "handstand": greet naturally, ask about their level, ask about background. Do NOT push prices.

Examples:
"Are you already working on handstands or just starting?"
"Mostly wall work or freestanding?"
"What's your background? Yoga, gym, calisthenics?"

Goal: build real trust and long term students. Make people feel understood and safe.

LANGUAGE: Reply in the same language the client uses.`

const STORAGE_KEY = 'claude_skill_prompt'

export default function StylePanel() {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // Load from server first, fall back to localStorage
    fetch('http://localhost:3001/api/claude/skill')
      .then(r => r.json())
      .then(d => { if (d.prompt) setPrompt(d.prompt) })
      .catch(() => {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) setPrompt(stored)
      })
  }, [])

  const save = () => {
    localStorage.setItem(STORAGE_KEY, prompt)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Also send to server
    fetch('http://localhost:3001/api/claude/skill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    }).catch(() => {})
  }

  return (
    <div className="flex flex-col h-full border-r" style={{ borderColor: 'var(--border)', background: 'var(--background)' }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--foreground)' }}>Скилл Claude</div>
        <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          Правила которые Claude всегда использует при генерации ответов
        </div>
      </div>

      <div className="flex-1 p-3 overflow-hidden flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          className="flex-1 resize-none rounded-xl p-3 text-xs leading-relaxed outline-none"
          style={{
            background: 'var(--muted)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            fontFamily: 'inherit'
          }}
          placeholder="Опиши стиль, методику, правила..."
          spellCheck={false}
        />
        <button
          onClick={save}
          className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: saved ? 'var(--status-client)' : 'var(--accent)',
            color: '#1a1610',
            cursor: 'pointer'
          }}
        >
          {saved ? '✓ Сохранено' : 'Сохранить скилл'}
        </button>
        <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
          Claude использует этот промпт при каждом запросе
        </p>
      </div>
    </div>
  )
}

// Export function to get current skill prompt
export function getSkillPrompt(): string {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_PROMPT
}
