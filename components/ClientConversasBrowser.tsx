'use client'

import { useMemo, useState } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

const statusStyle: Record<string, React.CSSProperties> = {
  open:      { color: C.yellow, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' },
  resolved:  { color: C.green,  background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.2)' },
  escalated: { color: C.red,    background: 'rgba(232,64,64,0.1)',   border: '1px solid rgba(232,64,64,0.2)' },
}
const statusLabel: Record<string, string> = { open: 'Em aberto', resolved: 'Resolvido', escalated: 'Com atendente' }
const statusHelp: Record<string, string> = {
  open: 'Conversa ainda em andamento com o agente.',
  resolved: 'O agente concluiu o atendimento.',
  escalated: 'Foi passada para uma pessoa da sua equipe.',
}

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}

export interface ClientConv {
  id: string
  contact_identifier: string | null
  channel: string
  status: string
  started_at: string
  message_count: number
}

export function ClientConversasBrowser({ conversas }: { conversas: ClientConv[] }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [canal, setCanal] = useState('all')
  const [periodo, setPeriodo] = useState('all')

  const canais = useMemo(() => Array.from(new Set(conversas.map(c => c.channel).filter(Boolean))), [conversas])

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase()
    const agora = Date.now()
    const janela = periodo === '7' ? 7 * 86400000 : periodo === '30' ? 30 * 86400000 : null
    return conversas.filter(c => {
      if (status !== 'all' && c.status !== status) return false
      if (canal !== 'all' && c.channel !== canal) return false
      if (janela && agora - new Date(c.started_at).getTime() > janela) return false
      if (termo && !`${formatContact(c.contact_identifier)} ${c.contact_identifier ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [conversas, q, status, canal, periodo])

  function exportarCSV() {
    const head = ['Contato', 'Canal', 'Status', 'Mensagens', 'Inicio']
    const linhas = filtradas.map(c => [
      formatContact(c.contact_identifier), c.channel, statusLabel[c.status] ?? c.status,
      String(c.message_count ?? 0),
      new Date(c.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    ])
    const csv = [head, ...linhas].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `conversas-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const limpar = q || status !== 'all' || canal !== 'all' || periodo !== 'all'

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar pelo contato…" style={{ flex: 1, minWidth: 200, maxWidth: 320 }} />
        <select className="field" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">Todos os status</option>
          <option value="open">Em aberto</option>
          <option value="resolved">Resolvido</option>
          <option value="escalated">Com atendente</option>
        </select>
        {canais.length > 1 && (
          <select className="field" value={canal} onChange={e => setCanal(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Todos os canais</option>
            {canais.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <select className="field" value={periodo} onChange={e => setPeriodo(e.target.value)} style={{ width: 'auto' }}>
          <option value="all">Qualquer data</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
        </select>
        <button onClick={exportarCSV} className="btn-ghost" style={{ fontSize: 12, padding: '10px 16px' }}>⬇ Exportar</button>
      </div>

      <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginBottom: 14 }}>
        Mostrando {filtradas.length} de {conversas.length} conversa(s).
        {limpar && <button onClick={() => { setQ(''); setStatus('all'); setCanal('all'); setPeriodo('all') }} style={{ background: 'none', border: 'none', color: C.blueB, cursor: 'pointer', fontFamily: FONT.jb, fontSize: 10, marginLeft: 8 }}>limpar filtros</button>}
      </p>

      {/* Legenda didática */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
        {(['open', 'resolved', 'escalated'] as const).map(s => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusStyle[s].color as string }} />
            <span style={{ fontFamily: FONT.dm, fontSize: 11, color: C.muted }}><b style={{ color: C.white, fontWeight: 500 }}>{statusLabel[s]}:</b> {statusHelp[s]}</span>
          </div>
        ))}
      </div>

      {/* Lista */}
      <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Contato', 'Canal', 'Status', 'Mensagens', 'Início'].map(h => (
            <span key={h} style={{ fontFamily: FONT.jb, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.faint }}>{h}</span>
          ))}
        </div>

        {!filtradas.length && (
          <div style={{ padding: '56px 24px', textAlign: 'center', fontFamily: FONT.dm, fontSize: 14, color: C.muted, fontWeight: 300 }}>
            {conversas.length
              ? 'Nenhuma conversa encontrada com esses filtros.'
              : 'Nenhuma conversa ainda. Elas aparecem aqui assim que o agente começar a atender.'}
          </div>
        )}

        {filtradas.map(c => (
          <a key={c.id} href={`/painel/conversas/${c.id}`} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16, cursor: 'pointer' }}>
            <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 14, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatContact(c.contact_identifier)}</span>
            <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted }}>{c.channel}</span>
            <span style={{ fontFamily: FONT.jb, fontSize: 9, letterSpacing: '0.05em', padding: '4px 10px', borderRadius: 100, width: 'fit-content', ...statusStyle[c.status] }}>{statusLabel[c.status]}</span>
            <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.muted }}>{c.message_count ?? 0}</span>
            <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.faint }}>{new Date(c.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
