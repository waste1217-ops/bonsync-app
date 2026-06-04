'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { C, FONT } from '@/lib/styles'

export function DealActions({ dealId }: { dealId: string }) {
  const [loading, setLoading] = useState('')
  const router   = useRouter()
  const supabase = createClient()

  async function update(status: 'confirmed' | 'rejected') {
    setLoading(status)
    await supabase.from('deals').update({
      status,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
    }).eq('id', dealId)
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button onClick={() => update('confirmed')} disabled={!!loading} className="btn-primary" style={{ fontSize: 12, padding: '8px 16px' }}>
        {loading === 'confirmed' ? '…' : 'Confirmar'}
      </button>
      <button onClick={() => update('rejected')} disabled={!!loading} className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>
        {loading === 'rejected' ? '…' : 'Descartar'}
      </button>
    </div>
  )
}
