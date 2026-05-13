import { useState, useEffect } from 'react'

export interface Template {
  id: string
  question: string
  answer: string
  tags: string[]
  usedCount: number
  createdAt: string
}

const TEMPLATES_KEY = 'tp_templates'
const TEMPLATES_VERSION_KEY = 'tp_templates_version'
const TEMPLATES_VERSION = '2'

const SEED_TEMPLATES: Template[] = [
  {
    id: 'seed_handstand_1',
    question: 'Someone writes "handstand"',
    answer: 'Hey 👋\n\nWhat\'s pulling you more right now:\nhandstand itself,\nor more general mobility and movement too?',
    tags: ['handstand'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_handstand_2',
    question: 'Handstand — check level',
    answer: 'Hey 👋\n\nWhat\'s your current level with handstands?\nTotal beginner or already kicking up against a wall?',
    tags: ['handstand'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_mobility',
    question: 'Interested in mobility / flexibility',
    answer: 'Hey 👋\n\nAre you mostly interested in flexibility,\ngeneral mobility,\nor more handstand focused mobility like shoulders, hips and spine?',
    tags: ['mobility'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_start',
    question: 'Where to start? Beginner',
    answer: 'Nice, that\'s actually a really good place to start 👍\n\nA lot of people think handstands are only about balance or strength,\nbut usually it\'s more about learning how to use your body properly.\n\nShoulders, core, hips, alignment, body awareness.\n\nThat\'s the real foundation.\n\nDo you already train something right now?\nGym, yoga, calisthenics, sports?',
    tags: ['start'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_injuries',
    question: 'Injury / pain / limitation',
    answer: 'Got you 👍\n\nInjuries or pain usually don\'t mean we have to stop completely.\nMost of the time we can work around them and still improve a lot.\n\nMobility, core, hip work, alignment, breathing, posture, movement quality.\n\nAll of that still matters for handstand progress.\n\nWhat exactly is bothering you right now?',
    tags: ['injuries'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_program',
    question: 'How does the program / training work?',
    answer: 'Right now I mainly work in a 1:1 online format.\n\nWe train together once a week through WhatsApp or another platform that works for you.\n\nI guide you through the full process:\nwarm up, mobility, strength, handstand work, corrections, recovery.\n\nAnd between sessions you\'ll also have your own training program to follow.\n\nI adapt everything to your level and your body.',
    tags: ['program', 'online'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_online',
    question: 'Is it online? How does online coaching work?',
    answer: 'Most of my coaching is online 👍\n\nUsually we do 1 live session per week.\n\nAnd outside the session:\nyou practice with your structured homework and send me videos for corrections.\n\nThat way progress continues between sessions too.',
    tags: ['online'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_price',
    question: 'How much? Price / cost?',
    answer: 'One session is 70€.\n\nSessions usually last around 60 to 100 minutes depending on the training.\n\nPayment is through Wise or crypto.\n\nI keep a limited amount of students because I prefer working seriously and long term with people.',
    tags: ['price'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_schedule',
    question: 'Ready to start — schedule / availability',
    answer: 'If it feels aligned for you,\nsend me your:\n• time zone\n• usual schedule\n• preferred training times\n\nand I\'ll see what slots I currently have available 👍',
    tags: ['schedule'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_course',
    question: 'Too expensive / looking for cheaper option',
    answer: 'If 1:1 coaching feels too expensive right now,\nno worries 👍\n\nI\'m currently working on an online program/course\nthat people will be able to follow on their own at a much more accessible price.\n\nIt\'s not fully finished yet,\nbut I can add you to the waiting list and let you know once it\'s ready.',
    tags: ['course', 'price'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_advanced',
    question: 'Person already trains / has background',
    answer: 'That\'s actually great because your body already has a foundation.\n\nUsually people who already trained in other disciplines progress much faster because their body already understands strength and adaptation.\n\nThen it becomes more about:\ncontrol, mobility, alignment, awareness and consistency.\n\nThose are the things that really unlock advanced handstand work.',
    tags: ['handstand', 'start'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_followup',
    question: 'Follow-up / checking in',
    answer: 'Hey 👋\nJust checking in.\n\nAre you still interested in starting your training?',
    tags: ['followup'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_whatsapp',
    question: 'Move to WhatsApp',
    answer: 'It\'s usually easier to continue on WhatsApp 👍\n\nYou can message me there and we\'ll organize everything:\n\n+84 35 426 3095',
    tags: ['schedule', 'online'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
]

export function loadTemplates(): Template[] {
  try {
    const storedVersion = localStorage.getItem(TEMPLATES_VERSION_KEY)
    const raw = localStorage.getItem(TEMPLATES_KEY)

    if (!raw || storedVersion !== TEMPLATES_VERSION) {
      // Keep any user-created templates (non-seed ids), merge with new seeds
      const existing: Template[] = raw ? JSON.parse(raw) : []
      const userTemplates = existing.filter(t => !t.id.startsWith('seed_'))
      const merged = [...SEED_TEMPLATES, ...userTemplates]
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(merged))
      localStorage.setItem(TEMPLATES_VERSION_KEY, TEMPLATES_VERSION)
      return merged
    }
    return JSON.parse(raw)
  } catch { return SEED_TEMPLATES }
}

function saveTemplates(templates: Template[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

const ALL_TAGS = ['price', 'start', 'handstand', 'mobility', 'injuries', 'course', 'schedule', 'program', 'online', 'trial']

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  )
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  )
}

interface TemplatesPanelProps {
  onUse: (text: string) => void
}

export default function TemplatesPanel({ onUse }: TemplatesPanelProps) {
  const [templates, setTemplates] = useState<Template[]>([])
  const [filterTag, setFilterTag] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQ, setEditQ] = useState('')
  const [editA, setEditA] = useState('')
  const [editTagStr, setEditTagStr] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newQ, setNewQ] = useState('')
  const [newA, setNewA] = useState('')
  const [newTagStr, setNewTagStr] = useState('')

  useEffect(() => {
    setTemplates(loadTemplates())
  }, [])

  const persist = (next: Template[]) => {
    setTemplates(next)
    saveTemplates(next)
  }

  const copy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const startEdit = (t: Template) => {
    setEditingId(t.id)
    setEditQ(t.question)
    setEditA(t.answer)
    setEditTagStr(t.tags.join(', '))
  }

  const saveEdit = (id: string) => {
    persist(templates.map(t =>
      t.id === id
        ? { ...t, question: editQ.trim(), answer: editA.trim(), tags: editTagStr.split(',').map(s => s.trim()).filter(Boolean) }
        : t
    ))
    setEditingId(null)
  }

  const deleteTemplate = (id: string) => {
    persist(templates.filter(t => t.id !== id))
  }

  const addTemplate = () => {
    if (!newA.trim()) return
    const t: Template = {
      id: `t_${Date.now()}`,
      question: newQ.trim(),
      answer: newA.trim(),
      tags: newTagStr.split(',').map(s => s.trim()).filter(Boolean),
      usedCount: 0,
      createdAt: new Date().toISOString(),
    }
    persist([t, ...templates])
    setAdding(false)
    setNewQ('')
    setNewA('')
    setNewTagStr('')
  }

  const useTemplate = (t: Template) => {
    persist(templates.map(x => x.id === t.id ? { ...x, usedCount: x.usedCount + 1 } : x))
    onUse(t.answer)
  }

  const allTags = Array.from(new Set([...ALL_TAGS, ...templates.flatMap(t => t.tags)])).filter(Boolean)

  const visible = templates
    .filter(t => !filterTag || t.tags.includes(filterTag))
    .filter(t => !search || t.question.toLowerCase().includes(search.toLowerCase()) || t.answer.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--background)' }}>

      {/* Search + Add */}
      <div className="px-3 pt-2 pb-2 border-b flex gap-2" style={{ borderColor: 'var(--border)' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="flex-1 px-2 py-1.5 rounded-lg outline-none text-xs"
          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
        />
        <button
          onClick={() => setAdding(a => !a)}
          title="Add template"
          className="px-2 py-1.5 rounded-lg flex items-center gap-1 text-xs font-medium transition-all"
          style={{
            background: adding ? 'var(--accent)' : 'var(--muted)',
            color: adding ? '#1a1610' : 'var(--muted-foreground)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          <PlusIcon />
        </button>
      </div>

      {/* Tag filters */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={() => setFilterTag(null)}
          className="px-2 py-0.5 rounded-full text-xs whitespace-nowrap shrink-0 transition-all"
          style={{
            background: !filterTag ? 'var(--accent)' : 'var(--muted)',
            color: !filterTag ? '#1a1610' : 'var(--muted-foreground)',
            cursor: 'pointer',
          }}
        >
          All
        </button>
        {allTags.map(tag => (
          <button
            key={tag}
            onClick={() => setFilterTag(filterTag === tag ? null : tag)}
            className="px-2 py-0.5 rounded-full text-xs whitespace-nowrap shrink-0 transition-all"
            style={{
              background: filterTag === tag ? 'var(--accent)' : 'var(--muted)',
              color: filterTag === tag ? '#1a1610' : 'var(--muted-foreground)',
              cursor: 'pointer',
            }}
          >
            #{tag}
          </button>
        ))}
      </div>

      {/* Add form */}
      {adding && (
        <div className="mx-3 mt-3 p-3 rounded-xl flex flex-col gap-2" style={{ background: 'var(--card)', border: '1px solid var(--accent)' }}>
          <textarea
            value={newQ}
            onChange={e => setNewQ(e.target.value)}
            placeholder="When to use? (optional)"
            rows={1}
            className="resize-none rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          />
          <textarea
            value={newA}
            onChange={e => setNewA(e.target.value)}
            placeholder="Reply text *"
            rows={3}
            className="resize-none rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          />
          <input
            value={newTagStr}
            onChange={e => setNewTagStr(e.target.value)}
            placeholder="Tags, comma-separated: price, start"
            className="rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          />
          <div className="flex gap-2">
            <button
              onClick={addTemplate}
              disabled={!newA.trim()}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: 'var(--accent)', color: '#1a1610', cursor: newA.trim() ? 'pointer' : 'default', opacity: newA.trim() ? 1 : 0.4 }}
            >
              Save
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
              {templates.length === 0 ? 'No templates — add your first' : 'Nothing found'}
            </p>
          </div>
        )}

        {visible.map(t => (
          <div
            key={t.id}
            className="rounded-xl p-3 flex flex-col gap-2"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            {/* Tags */}
            {t.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {t.tags.map(tag => (
                  <span key={tag} className="px-1.5 py-0.5 rounded-full text-xs" style={{ background: 'var(--muted)', color: 'var(--accent)' }}>
                    #{tag}
                  </span>
                ))}
                {t.usedCount > 0 && (
                  <span className="ml-auto text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
                    ×{t.usedCount}
                  </span>
                )}
              </div>
            )}

            {/* Question context */}
            {t.question && editingId !== t.id && (
              <p className="text-xs leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
                {t.question}
              </p>
            )}

            {/* Edit mode */}
            {editingId === t.id ? (
              <div className="flex flex-col gap-2">
                <textarea
                  value={editQ}
                  onChange={e => setEditQ(e.target.value)}
                  placeholder="When to use?"
                  rows={1}
                  className="resize-none rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                />
                <textarea
                  value={editA}
                  onChange={e => setEditA(e.target.value)}
                  rows={4}
                  className="resize-none rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--accent)' }}
                />
                <input
                  value={editTagStr}
                  onChange={e => setEditTagStr(e.target.value)}
                  placeholder="Tags, comma-separated"
                  className="rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t.id)} className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--accent)', color: '#1a1610', cursor: 'pointer' }}>
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Answer text */}
                <p className="text-xs leading-relaxed" style={{ color: 'var(--foreground)' }}>{t.answer}</p>

                {/* Actions */}
                <div className="flex items-center gap-1.5 mt-1">
                  {/* Copy */}
                  <button
                    onClick={() => copy(t.id, t.answer)}
                    title="Copy"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                    style={{
                      background: copiedId === t.id ? 'rgba(100,200,100,0.15)' : 'var(--muted)',
                      color: copiedId === t.id ? 'var(--status-client)' : 'var(--muted-foreground)',
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                    }}
                  >
                    {copiedId === t.id ? '✓' : <CopyIcon />}
                  </button>

                  {/* Edit */}
                  <button
                    onClick={() => startEdit(t)}
                    title="Edit template"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                    style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'pointer', border: '1px solid var(--border)' }}
                  >
                    <EditIcon />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    title="Delete"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                    style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'pointer', border: '1px solid var(--border)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e05252' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--muted-foreground)' }}
                  >
                    <TrashIcon />
                  </button>

                  {/* Use → fills Dialog input */}
                  <button
                    onClick={() => useTemplate(t)}
                    className="ml-auto px-3 py-1 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'var(--accent)', color: '#1a1610', cursor: 'pointer' }}
                  >
                    Use →
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Footer count */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <span className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.5 }}>
          {visible.length} of {templates.length} templates
        </span>
      </div>
    </div>
  )
}
