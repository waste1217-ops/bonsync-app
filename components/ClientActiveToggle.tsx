'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ClientActiveToggle({ clientId, initialActive, clientName }: { clientId: string; initialActive: boolean; clientName: string }) {
  const [active, setActive] = useState(initialActive)
  const [busy, setBusy]     = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function toggle() {
    const novo = !active
    const msg = novo
      ? `Reativar o acesso de "${clientName}"? Ele poderá fazer login novamente.`
      : `Suspender o acesso de "${clientName}"? Ele será desconectado e não conseguirá entrar até ser reativado. Os dados são mantidos.`
    if (!confirm(msg)) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ active: novo }).eq('id', clientId)
    if (error) { alert(error.message); setBusy(false); return }
    setActive(novo)
    setBusy(false)
    router.refresh()
  }

  return (
    <button onClick={toggle} disabled={busy} className="btn-ghost"
      style={{ fontSize: 13, padding: '10px 20px', color: active ? 'var(--c-yellow)' : 'var(--c-green)' }}>
      {busy ? '…' : active ? 'Suspender acesso' : 'Reativar acesso'}
    </button>
  )
}
