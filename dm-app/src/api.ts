const BASE = 'http://localhost:3001/api'

export interface MediaItem {
  id: string
  caption: string
  type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  thumbnail: string | null
  timestamp: string
  commentsCount: number
}

export interface Comment {
  id: string
  text: string
  username: string
  timestamp: string
  likeCount: number
  liked?: boolean
  replies: { id: string; text: string; username: string; timestamp: string }[]
}

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
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function patch<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export const api = {
  health: () => get<{ ok: boolean; connected: boolean; selfId: string; conversations: number }>('/health'),
  conversations: () => get<ConversationSummary[]>('/conversations'),
  messages: (id: string) => get<ConversationDetail>(`/conversations/${id}/messages`),
  send: (id: string, text: string) => post<{ ok: boolean }>(`/conversations/${id}/send`, { text }),
  setStatus: (id: string, status: string) => patch(`/conversations/${id}/status`, { status }),
  setNote: (id: string, note: string) => patch(`/conversations/${id}/status`, { note }),
  media: () => get<MediaItem[]>('/media'),
  comments: (mediaId: string) => get<Comment[]>(`/media/${mediaId}/comments`),
  likeComment: (commentId: string) => post<{ ok: boolean }>(`/comments/${commentId}/like`, {}),
  unlikeComment: (commentId: string) => del<{ ok: boolean }>(`/comments/${commentId}/like`),
  deleteComment: (commentId: string) => del<{ ok: boolean }>(`/comments/${commentId}`),
  replyToComment: (mediaId: string, text: string, commentId: string, username?: string) =>
    post<{ ok: boolean; id?: string }>(`/media/${mediaId}/reply`, { text, commentId, username }),
  suggestCommentReply: (postCaption: string, commentText: string, username: string) =>
    post<{ suggestions: string[] }>('/claude/suggest-comment', { postCaption, commentText, username }),
  translate: (text: string) =>
    post<{ translation: string }>('/claude/translate', { text }),
}
