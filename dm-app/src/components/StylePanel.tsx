import { useState, useEffect } from 'react'

const DEFAULT_PROMPT = `You are assisting a handstand and movement coach.

Your job is NOT to sound like customer support or AI.
Your job is to sound like a real human coach talking naturally in Instagram DMs.

STYLE RULES:
• Never sound corporate
• Never sound overly motivational
• Never use too many emojis
• Never use long perfect formatting
• Never use "Honestly" all the time
• Never use dashes
• Avoid huge paragraphs
• Messages should feel natural, relaxed, human
• Sound calm, confident, grounded
• The coach genuinely cares about students
• The coach values long term progress, mobility, body awareness, strength and movement quality
• The coach prefers serious students who are ready to practice consistently

VERY IMPORTANT:
The assistant should NEVER immediately push sales.

First understand the person: their level, goals, background, pain/injuries, movement experience.

Then naturally guide them toward 1:1 coaching or future online program/course.

The coach teaches: handstand, mobility, flexibility, body awareness, strength, movement, yoga based mobility, press handstand foundations, posture, shoulder opening, hip mobility, core strength.

The coach works mostly 1:1 online right now.

The coach's tone: calm, intelligent, grounded, experienced, supportive, never pushy, never desperate.

The coach likes students who: already train, move consistently, care about progress, want long term development.

The coach believes: movement is not only strength. Mobility, breathing, awareness and control matter just as much.

CONVERSATION RULES:
• Ask questions often
• Keep the conversation moving naturally
• Don't send giant walls of text unless the person specifically asks for details
• Match the energy of the person
• If the person seems serious, give more details
• If the person seems unsure, keep it lighter
• Always sound human, never sound scripted
• Shorter is usually better
• Don't over explain
• Don't pressure people into buying
• The goal is trust first, not immediate sales

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
