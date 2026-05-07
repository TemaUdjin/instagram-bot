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

const SEED_TEMPLATES: Template[] = [
  {
    id: 'seed_1',
    question: 'Сколько стоит? Какая цена?',
    answer: 'Смотри, у нас два уровня — базовый и продвинутый. Базовый подойдёт если только начинаешь или хочешь систему. Напиши что тебя больше интересует и скину точные детали.',
    tags: ['цена'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_2',
    question: 'С чего начать? Я новичок',
    answer: 'Лучшая точка входа — базовый уровень. Там с нуля: мобильность, основы хэндстенда, контроль тела. Всё в своём темпе, никаких "надо быть гибким с детства". Расскажи немного о себе — что уже есть из опыта?',
    tags: ['начало'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'seed_3',
    question: 'Травма / боль / ограничение',
    answer: 'Это важно учесть. Расскажи подробнее — что именно, давно ли, что триггерит? В большинстве случаев мы работаем вокруг ограничений, а не через них.',
    tags: ['травмы'],
    usedCount: 0,
    createdAt: new Date().toISOString(),
  },
]

export function loadTemplates(): Template[] {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY)
    if (!raw) {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(SEED_TEMPLATES))
      return SEED_TEMPLATES
    }
    return JSON.parse(raw)
  } catch { return SEED_TEMPLATES }
}

function saveTemplates(templates: Template[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates))
}

const ALL_TAGS = ['цена', 'начало', 'хэндстенд', 'мобильность', 'травмы', 'курс', 'время', 'программа']

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
          placeholder="Поиск по шаблонам..."
          className="flex-1 px-2 py-1.5 rounded-lg outline-none text-xs"
          style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
        />
        <button
          onClick={() => setAdding(a => !a)}
          title="Добавить шаблон"
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
          Все
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
            placeholder="Когда использовать? (необязательно)"
            rows={1}
            className="resize-none rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          />
          <textarea
            value={newA}
            onChange={e => setNewA(e.target.value)}
            placeholder="Текст ответа *"
            rows={3}
            className="resize-none rounded-lg px-2 py-1.5 text-xs outline-none"
            style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
          />
          <input
            value={newTagStr}
            onChange={e => setNewTagStr(e.target.value)}
            placeholder="Теги через запятую: цена, начало"
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
              Сохранить
            </button>
            <button
              onClick={() => setAdding(false)}
              className="px-3 py-1.5 rounded-lg text-xs transition-all"
              style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'pointer' }}
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Template list */}
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <p className="text-xs" style={{ color: 'var(--muted-foreground)', opacity: 0.6 }}>
              {templates.length === 0 ? 'Нет шаблонов — добавь первый' : 'Ничего не найдено'}
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
                  placeholder="Когда использовать?"
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
                  placeholder="Теги через запятую"
                  className="rounded-lg px-2 py-1.5 text-xs outline-none"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)', border: '1px solid var(--border)' }}
                />
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(t.id)} className="flex-1 py-1.5 rounded-lg text-xs font-medium" style={{ background: 'var(--accent)', color: '#1a1610', cursor: 'pointer' }}>
                    Сохранить
                  </button>
                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'pointer' }}>
                    Отмена
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
                    title="Скопировать"
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
                    title="Редактировать шаблон"
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                    style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', cursor: 'pointer', border: '1px solid var(--border)' }}
                  >
                    <EditIcon />
                  </button>

                  {/* Delete */}
                  <button
                    onClick={() => deleteTemplate(t.id)}
                    title="Удалить"
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
                    Использовать →
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
          {visible.length} из {templates.length} шаблонов
        </span>
      </div>
    </div>
  )
}
