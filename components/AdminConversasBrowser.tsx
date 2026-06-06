'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

export interface Conv {
  id: string
  contact_identifier: string | null
  channel: string
  status: string
  started_at: string
  is_favorite?: boolean
  empresa: string
  agente: string
}

function StarButton({ conv, onToggle }: { conv: Conv; onToggle: (id: string, v: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const supabase = createClient()
  async function toggle(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    if (busy) return
    setBusy(true)
    const novo = !conv.is_favorite
    const { error } = await supabase.from('conversations').update({ is_favorite: novo }).eq('id', conv.id)
    setBusy(false)
    if (error) { alert('Não foi possível favoritar: ' + error.message); return }
    onToggle(conv.id, novo)
  }
  return (
    <button onClick={toggle} title={conv.is_favorite ? 'Remover dos favoritos' : 'Marcar como importante'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 2, color: conv.is_favorite ? C.yellow : C.faint, opacity: busy ? 0.5 : 1 }}>
      {conv.is_favorite ? '★' : '☆'}
    </button>
  )
}

function Group({ empresa, convs, onToggle }: { empresa: string; convs: Conv[]; onToggle: (id: string, v: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const abertas = convs.filter(c => c.status === 'open').length

  return (
    <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', background: open ? 'rgba(80,130,210,0.06)' : 'transparent',
        border: 'none', borderBottom: open ? `1px solid ${C.border}` : 'none',
        cursor: 'pointer', transition: 'background .2s', textAlign: 'left',
      }}>
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

      {open && (
        <div className="animate-slide-up">
          {(['open', 'escalated', 'resolved'] as const).map(status => {
            const lista = convs.filter(c => c.status === status)
            if (!lista.length) return null
            return (
              <div key={status}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px', background: 'rgba(0,0,0,0.15)', borderTop: `1px solid ${C.border}` }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusStyle[status].color as string }} />
                  <span style={{ ...S.mono, fontSize: 9, color: statusStyle[status].color as string }}>{statusLabel[status]}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint }}>· {lista.length}</span>
                </div>
                {lista.map(c => (
                  <div key={c.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '24px 2fr 1.2fr 1fr 1fr', gap: 16, alignItems: 'center' }}>
                    <StarButton conv={c} onToggle={onToggle} />
                    <a href={`/admin/conversas/${c.id}`} style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 14, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {formatContact(c.contact_identifier)}
                    </a>
                    <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.agente}</span>
                    <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted }}>{c.channel}</span>
                    <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.faint, textAlign: 'right' }}>
                      {new Date(c.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function AdminConversasBrowser({ conversas }: { conversas: Conv[] }) {
  const [lista, setLista]   = useState<Conv[]>(conversas)
  const [q, setQ]           = useState('')
  const [status, setStatus] = useState('all')
  const [favOnly, setFav]   = useState(false)

  function onToggle(id: string, v: boolean) {
    setLista(prev => prev.map(c => c.id === id ? { ...c, is_favorite: v } : c))
  }

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase()
    return lista.filter(c => {
      if (status !== 'all' && c.status !== status) return false
      if (favOnly && !c.is_favorite) return false
      if (termo) {
        const alvo = `${c.empresa} ${c.agente} ${formatContact(c.contact_identifier)} ${c.contact_identifier ?? ''}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [lista, q, status, favOnly])

  const grupos = useMemo(() => {
    const g: Record<string, Conv[]> = {}
    for (const c of filtradas) { (g[c.empresa] ??= []).push(c) }
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
  }, [filtradas])

  function exportarCSV() {
    const head = ['Cliente', 'Contato', 'Agente', 'Canal', 'Status', 'Favorito', 'Inicio']
    const linhas = filtradas.map(c => [
      c.empresa,
      formatContact(c.contact_identifier),
      c.agente,
      c.channel,
      statusLabel[c.status] ?? c.status,
      c.is_favorite ? 'Sim' : 'Nao',
      new Date(c.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    ])
    const csv = [head, ...linhas]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      .join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversas-bonsync-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const selStyle: React.CSSProperties = { fontFamily: FONT.jb, fontSize: 12 }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input className="field" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Buscar por cliente, agente ou contato…"
          style={{ flex: 1, minWidth: 220, maxWidth: 360 }} />
        <select className="field" value={status} onChange={e => setStatus(e.target.value)} style={{ ...selStyle, width: 'auto' }}>
          <option value="all">Todos os status</option>
          <option value="open">Em aberto</option>
          <option value="escalated">Escalado</option>
          <option value="resolved">Resolvido</option>
        </select>
        <button onClick={() => setFav(f => !f)} className="btn-ghost"
          style={{ fontSize: 12, padding: '10px 16px', color: favOnly ? C.yellow : C.muted, borderColor: favOnly ? 'rgba(245,158,11,0.4)' : undefined }}>
          {favOnly ? '★ Favoritos' : '☆ Favoritos'}
        </button>
        <button onClick={exportarCSV} className="btn-ghost" style={{ fontSize: 12, padding: '10px 16px' }}>
          ⬇ Exportar CSV
        </button>
      </div>

      <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginBottom: 14 }}>
        {filtradas.length} conversa(s) em {grupos.length} cliente(s)
      </p>

      {!filtradas.length ? (
        <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, padding: '48px 24px', textAlign: 'center', fontFamily: FONT.dm, fontSize: 14, color: C.muted, fontWeight: 300 }}>
          Nenhuma conversa encontrada com esses filtros.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {grupos.map(([empresa, convs]) => (
            <Group key={empresa} empresa={empresa} convs={convs} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  )
}
