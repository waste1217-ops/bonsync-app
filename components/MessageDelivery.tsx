'use client'

import { useState } from 'react'
import { C, FONT } from '@/lib/styles'

// Mostra o status de entrega de uma resposta do agente e permite reenviar se falhou.
export function MessageDelivery({ messageId, status, error }: { messageId: string; status?: string | null; error?: string | null }) {
  const [st, setSt] = useState(status || 'enviada') // mensagens antigas (sem status) = considera entregue
  const [err, setErr] = useState(error || '')
  const [busy, setBusy] = useState(false)

  async function reenviar() {
    setBusy(true)
    const res = await fetch('/api/messages/resend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message_id: messageId }),
    })
    const data = await res.json()
    setBusy(false)
    if (res.ok) { setSt('enviada'); setErr('') }
    else { setSt('falha'); setErr(data.error || 'Falha ao reenviar.') }
  }

  if (st === 'enviada') {
    return <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.green }}>✓ enviada</span>
  }
  if (st === 'enviando') {
    return <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.muted }}>enviando…</span>
  }
  // falha
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
      <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.red }} title={err}>⚠ não enviada ao cliente</span>
      <button onClick={reenviar} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.jb, fontSize: 10, color: C.blueB, padding: 0 }}>
        {busy ? 'Reenviando…' : 'Tentar enviar novamente'}
      </button>
    </span>
  )
}
