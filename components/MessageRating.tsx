'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C } from '@/lib/styles'

export function MessageRating({ messageId, initial }: { messageId: string; initial: number | null }) {
  const [rating, setRating] = useState<number | null>(initial ?? null)
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  async function set(v: number) {
    if (busy) return
    setBusy(true)
    const novo = rating === v ? null : v // clicar de novo remove
    const { error } = await supabase.from('messages').update({ rating: novo }).eq('id', messageId)
    setBusy(false)
    if (error) { alert('Não foi possível avaliar: ' + error.message); return }
    setRating(novo)
  }

  const btn = (active: boolean): React.CSSProperties => ({
    background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, lineHeight: 1,
    padding: '2px 4px', opacity: busy ? 0.5 : active ? 1 : 0.4, transition: 'opacity .15s',
  })

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
      <button onClick={() => set(1)} title="Boa resposta" style={{ ...btn(rating === 1), color: rating === 1 ? C.green : C.faint }}>👍</button>
      <button onClick={() => set(-1)} title="Resposta ruim" style={{ ...btn(rating === -1), color: rating === -1 ? C.red : C.faint }}>👎</button>
    </span>
  )
}
