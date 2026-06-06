'use client'

import { useMemo, useState } from 'react'
import { C, T, FONT } from '@/lib/styles'

export interface Lead {
  id: string
  contact_identifier: string | null
  channel: string
  status: string
  lead_status: string | null
  lead_reason: string | null
  started_at: string
  message_count: number
}

const meta: Record<string, { label: string; color: string; bg: string; help: string }> = {
  qualificado: { label: 'Qualificado', color: C.green,  bg: 'rgba(34,197,94,0.1)',  help: 'Alta intenção de compra — atenda já.' },
  potencial:   { label: 'Potencial',   color: C.yellow, bg: 'rgba(245,158,11,0.1)', help: 'Interesse real, ainda decidindo.' },
  curioso:     { label: 'Curioso',     color: C.muted,  bg: 'rgba(80,130,210,0.08)', help: 'Só pesquisando, sem intenção clara.' },
  cliente:     { label: 'Cliente',     color: C.blueB,  bg: 'rgba(80,130,210,0.12)', help: 'Já fechou negócio.' },
  none:        { label: 'A classificar', color: C.faint, bg: 'rgba(80,130,210,0.05)', help: 'Ainda sem classificação.' },
}
const key = (l: Lead) => l.lead_status && meta[l.lead_status] ? l.lead_status : 'none'

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}

export function LeadsBrowser({ leads }: { leads: Lead[] }) {
  const [q, setQ] = useState('')
  const [filtro, setFiltro] = useState('all')

  const filtrados = useMemo(() => {
    const termo = q.trim().toLowerCase()
    return leads.filter(l => {
      if (filtro !== 'all' && key(l) !== filtro) return false
      if (termo && !`${formatContact(l.contact_identifier)} ${l.contact_identifier ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [leads, q, filtro])

  function exportarCSV() {
    const head = ['Contato', 'Classificacao', 'Motivo', 'Canal', 'Mensagens', 'Inicio']
    const linhas = filtrados.map(l => [
      formatContact(l.contact_identifier), meta[key(l)].label, l.lead_reason ?? '',
      l.channel, String(l.message_count ?? 0),
      new Date(l.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
    ])
    const csv = [head, ...linhas].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a')
    a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const filtros = [
    { v: 'all', l: `Todos (${leads.length})` },
    { v: 'qualificado', l: `Qualificados (${leads.filter(l => key(l) === 'qualificado').length})` },
    { v: 'potencial', l: `Potenciais (${leads.filter(l => key(l) === 'potencial').length})` },
    { v: 'curioso', l: `Curiosos (${leads.filter(l => key(l) === 'curioso').length})` },
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar contato…" style={{ flex: 1, minWidth: 200, maxWidth: 300 }} />
        {filtros.map(f => (
          <button key={f.v} onClick={() => setFiltro(f.v)} className={filtro === f.v ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 11, padding: '8px 14px' }}>{f.l}</button>
        ))}
        <button onClick={exportarCSV} className="btn-ghost" style={{ fontSize: 11, padding: '8px 14px' }}>⬇ Exportar</button>
      </div>

      <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 2fr 0.8fr 1fr', gap: 14, padding: '10px 22px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Contato', 'Classificação', 'Por quê', 'Msgs', 'Início'].map(h => (
            <span key={h} style={{ fontFamily: FONT.jb, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.faint }}>{h}</span>
          ))}
        </div>
        {!filtrados.length && (
          <div style={{ padding: '56px 24px', textAlign: 'center', fontFamily: FONT.dm, fontSize: 14, color: C.muted, fontWeight: 300 }}>
            {leads.length ? 'Nenhum lead com esse filtro.' : 'Os leads aparecem aqui conforme o agente conversa e classifica os contatos.'}
          </div>
        )}
        {filtrados.map(l => {
          const m = meta[key(l)]
          return (
            <a key={l.id} href={`/painel/conversas/${l.id}`} className="trow" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr 2fr 0.8fr 1fr', gap: 14, alignItems: 'center', cursor: 'pointer' }}>
              <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 14, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatContact(l.contact_identifier)}</span>
              <span style={{ fontFamily: FONT.jb, fontSize: 9, letterSpacing: '0.05em', padding: '4px 10px', borderRadius: 100, width: 'fit-content', color: m.color, background: m.bg, border: `1px solid ${m.color}33` }}>{m.label}</span>
              <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, fontWeight: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.lead_reason || '—'}</span>
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{l.message_count ?? 0}</span>
              <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.faint }}>{new Date(l.started_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}</span>
            </a>
          )
        })}
      </div>
    </div>
  )
}
