'use client'

import { useState } from 'react'
import { C, FONT } from '@/lib/styles'

const S = {
  mono: { fontFamily: FONT.jb, fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

const statusStyle: Record<string, React.CSSProperties> = {
  open:      { color: C.yellow, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' },
  resolved:  { color: C.green,  background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.2)' },
  escalated: { color: C.red,    background: 'rgba(232,64,64,0.1)',   border: '1px solid rgba(232,64,64,0.2)' },
}
const statusLabel: Record<string, string> = { open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado' }

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) {
    return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  }
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}

interface Conv {
  id: string
  contact_identifier: string | null
  channel: string
  status: string
  started_at: string
}

export function ClientConversations({ empresa, convs }: { empresa: string; convs: Conv[] }) {
  const [open, setOpen] = useState(false)
  const abertas = convs.filter(c => c.status === 'open').length

  return (
    <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      {/* Cabeçalho clicável */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', background: open ? 'rgba(80,130,210,0.06)' : 'transparent',
          border: 'none', borderBottom: open ? `1px solid ${C.border}` : 'none',
          cursor: 'pointer', transition: 'background .2s', textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: C.blueB, fontFamily: FONT.jb, fontSize: 12, transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▶</span>
          <span style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>{empresa}</span>
          <span style={{ ...S.mono, fontSize: 9, color: C.blueB, background: 'oklch(55% 0.24 225/0.12)', border: '1px solid oklch(55% 0.24 225/0.25)', padding: '3px 9px', borderRadius: 100 }}>
            {convs.length} conversa{convs.length > 1 ? 's' : ''}
          </span>
        </div>
        {abertas > 0 && (
          <span style={{ ...S.mono, fontSize: 9, ...statusStyle.open, padding: '3px 9px', borderRadius: 100 }}>
            {abertas} em aberto
          </span>
        )}
      </button>

      {/* Conteúdo expansível — agrupado por status */}
      {open && (
        <div className="animate-slide-up">
          {(['open', 'escalated', 'resolved'] as const).map(status => {
            const lista = convs.filter(c => c.status === status)
            if (!lista.length) return null
            return (
              <div key={status}>
                {/* Sub-cabeçalho do status */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: 'rgba(0,0,0,0.15)', borderTop: `1px solid ${C.border}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusStyle[status].color as string }} />
                  <span style={{ ...S.mono, fontSize: 9, color: statusStyle[status].color as string }}>
                    {statusLabel[status]}
                  </span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint }}>· {lista.length}</span>
                </div>
                {lista.map(c => (
                  <a key={c.id} href={`/admin/conversas/${c.id}`} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, cursor: 'pointer' }}>
                    <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 14, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatContact(c.contact_identifier)}
                    </span>
                    <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted }}>{c.channel}</span>
                    <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.faint, textAlign: 'right' }}>
                      {new Date(c.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </a>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
