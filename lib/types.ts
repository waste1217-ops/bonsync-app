export type Role = 'admin' | 'client'

export interface Profile {
  id: string
  email: string
  role: Role
  company_name: string | null
  created_at: string
}

export interface Agent {
  id: string
  client_id: string
  name: string
  description: string | null
  status: 'active' | 'paused' | 'error'
  config: Record<string, unknown>
  created_at: string
  updated_at: string
  profiles?: Profile
}

export interface Conversation {
  id: string
  agent_id: string
  contact_identifier: string | null
  channel: string
  status: 'open' | 'resolved' | 'escalated'
  started_at: string
  ended_at: string | null
  message_count: number
  agents?: Agent
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface DailyMetric {
  id: string
  agent_id: string
  date: string
  total_conversations: number
  resolved_conversations: number
  escalated_conversations: number
  avg_response_ms: number
  total_messages: number
}
