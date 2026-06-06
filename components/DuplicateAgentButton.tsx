'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DuplicateAgentButton({ agentId }: { agentId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function duplicar() {
    setLoading(true)
    const res = await fetch('/api/admin/duplicate-agent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: agentId }),
    })
    const data = await res.json()
    if (!res.ok) { alert(data.error || 'Erro ao duplicar.'); setLoading(false); return }
    router.push(`/admin/agentes/${data.id}/editar`)
  }

  return (
    <button onClick={duplicar} disabled={loading} className="btn-ghost" style={{ fontSize: 12, padding: '9px 18px' }}>
      {loading ? 'Duplicando…' : 'Duplicar'}
    </button>
  )
}
