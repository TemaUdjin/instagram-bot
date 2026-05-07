const BASE = 'http://localhost:3001/api'

export interface ConversationSummary {
  id: string
  name: string
  username: string
  avatar: string | null
  status: 'new' | 'replied' | 'client' | 'ignored' | 'followup'
  lastMessage: string
  waitMinutes: number
  unread: number
}

export interface Message {
  id: string
  type: 'incoming' | 'outgoing'
  text: string
  time: string
  attachments?: { type: string; url: string }[]
}

export interface ConversationDetail {
  profile: {
    name: string
    username: string
    avatar: string | null
    status: string
    note?: string
  }
  messages: Message[]
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

async function patch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json()
}

export const api = {
  health: () => get<{ ok: boolean; connected: boolean; selfId: string; conversations: number }>('/health'),
  conversations: () => get<ConversationSummary[]>('/conversations'),
  messages: (id: string) => get<ConversationDetail>(`/conversations/${id}/messages`),
  send: (id: string, text: string) => post<{ ok: boolean }>(`/conversations/${id}/send`, { text }),
  setStatus: (id: string, status: string) => patch(`/conversations/${id}/status`, { status }),
  setNote: (id: string, note: string) => patch(`/conversations/${id}/status`, { note }),
}
