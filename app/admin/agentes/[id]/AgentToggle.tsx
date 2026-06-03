'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, FONT, badgeStyle, agentStatusVariant, agentStatusLabel } from '@/lib/styles'

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label style={{ position: 'relative', width: 48, height: 26, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-block', opacity: disabled ? 0.5 : 1 }}>
      <input type="checkbox" checked={on} onChange={e => !disabled && onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 13, background: on ? 'oklch(55% 0.24 225)' : 'rgba(80,130,210,0.2)', transition: 'background .3s' }} />
      <div style={{ position: 'absolute', top: 4, left: on ? 26 : 4, width: 18, height: 18, borderRadius: '50%', background: '#eef2ff', transition: 'left .3s', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
    </label>
  )
}

export function AgentToggle({ agentId, initialStatus }: { agentId: string; initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus)
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function toggle(active: boolean) {
    if (saving || status === 'error') return
    setSaving(true)
    const newStatus = active ? 'active' : 'paused'
    await supabase.from('agents').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', agentId)
    setStatus(newStatus)
    setSaving(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
      <span style={badgeStyle(agentStatusVariant(status))}>{agentStatusLabel[status]}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>
          {status === 'active' ? 'Pausar' : 'Ativar'}
        </span>
        <Toggle on={status === 'active'} onChange={toggle} disabled={saving || status === 'error'} />
      </div>
      {status === 'error' && (
        <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.red, maxWidth: 200, textAlign: 'right' }}>
          Agente com erro — contate o suporte
        </p>
      )}
    </div>
  )
}
