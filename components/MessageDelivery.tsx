'use client'

import { useState } from 'react'
import { C, FONT } from '@/lib/styles'

// Status reais de entrega (refletem o ACK da integração, não só "chamou a função")
const META: Record<string, { label: string; cor: string }> = {
  pendente:       { label: '• pendente',          cor: 'var(--c-muted)' },
  enviando:       { label: 'enviando…',           cor: 'var(--c-muted)' },
  aceita:         { label: '✓ aceita pela API',   cor: 'var(--c-yellow)' },
  enviada:        { label: '✓ enviada',           cor: 'var(--c-green)' },
  entregue:       { label: '✓✓ entregue',         cor: 'var(--c-green)' },
  lida:           { label: '✓✓ lida',             cor: 'var(--c-blue-b)' },
  nao_confirmada: { label: '⚠ envio não confirmado', cor: 'var(--c-yellow)' },
}

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
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) { setSt('aceita'); setErr('') } // reenviado = aceito pela API; o ACK confirma depois
    else { setSt('falha'); setErr(data.error || 'Falha ao reenviar.') }
  }

  const meta = META[st]
  if (meta) {
    return <span style={{ fontFamily: FONT.jb, fontSize: 9, color: meta.cor }} title={st === 'aceita' ? 'A API aceitou; aguardando confirmação de entrega.' : undefined}>{meta.label}</span>
  }

  // falha (ou status desconhecido) → mostra aviso + reenviar
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
      <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.red }} title={err}>⚠ não enviada ao cliente</span>
      <button onClick={reenviar} disabled={busy} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.jb, fontSize: 10, color: C.blueB, padding: 0 }}>
        {busy ? 'Reenviando…' : 'Tentar enviar novamente'}
      </button>
    </span>
  )
}
