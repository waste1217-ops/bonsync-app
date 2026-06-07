'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AgentPauseToggle({ agentId, status }: { agentId: string; status: string }) {
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const ativo = status === 'active'

  async function toggle() {
    if (busy || status === 'error') return
    setBusy(true)
    const novo = ativo ? 'paused' : 'active'
    const { error } = await supabase.from('agents').update({ status: novo, updated_at: new Date().toISOString() }).eq('id', agentId)
    setBusy(false)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  if (status === 'error') return null

  return (
    <button onClick={toggle} disabled={busy} className="btn-ghost"
      style={{ fontSize: 12, padding: '9px 16px', color: ativo ? 'var(--c-yellow)' : 'var(--c-green)' }}>
      {busy ? '…' : ativo ? 'Pausar agente' : 'Reativar agente'}
    </button>
  )
}
