'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, FONT } from '@/lib/styles'

export function FavoriteToggle({ conversationId, initial }: { conversationId: string; initial: boolean }) {
  const [fav, setFav] = useState(initial)
  const [busy, setBusy] = useState(false)
  const supabase = createClient()

  async function toggle() {
    if (busy) return
    setBusy(true)
    const novo = !fav
    const { error } = await supabase.from('conversations').update({ is_favorite: novo }).eq('id', conversationId)
    setBusy(false)
    if (error) { alert('Não foi possível favoritar: ' + error.message); return }
    setFav(novo)
  }

  return (
    <button onClick={toggle} disabled={busy} className="btn-ghost"
      style={{ fontSize: 12, padding: '8px 14px', color: fav ? C.yellow : C.muted, borderColor: fav ? 'rgba(245,158,11,0.4)' : undefined, fontFamily: FONT.dm }}>
      {fav ? '★ Importante' : '☆ Marcar importante'}
    </button>
  )
}
