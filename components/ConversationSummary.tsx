'use client'

import { useState } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

export function ConversationSummary({ conversationId }: { conversationId: string }) {
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState('')
  const [error, setError] = useState('')

  async function gerar() {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/painel/resumo-conversa', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha.')
      setSummary(data.summary)
    } catch (e: any) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div style={{ ...CARD, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white }}>Resumo automático</h2>
          <p style={{ ...T.sub, fontSize: 12, marginTop: 2 }}>A IA lê a conversa e te entrega o essencial em segundos.</p>
        </div>
        {!summary && (
          <button onClick={gerar} disabled={loading} className="btn-primary" style={{ fontSize: 12 }}>
            {loading ? 'Resumindo…' : '✨ Gerar resumo'}
          </button>
        )}
      </div>

      {error && <p style={{ color: C.red, fontFamily: FONT.dm, fontSize: 13, marginTop: 12 }}>{error}</p>}

      {summary && (
        <div style={{ marginTop: 14, background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
          <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-wrap' }}>{summary}</p>
          <button onClick={gerar} disabled={loading} style={{ background: 'none', border: 'none', color: C.blueB, cursor: 'pointer', fontFamily: FONT.jb, fontSize: 10, marginTop: 10 }}>
            {loading ? 'Atualizando…' : '↻ Gerar novamente'}
          </button>
        </div>
      )}
    </div>
  )
}
