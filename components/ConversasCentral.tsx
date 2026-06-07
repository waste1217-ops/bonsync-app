'use client'

import { useMemo, useState } from 'react'
import { C, T, CARD, FONT } from '@/lib/styles'

export interface Conv {
  id: string
  contact_identifier: string | null
  channel: string
  status: string
  started_at: string
  ended_at: string | null
  message_count: number
  lead_status: string | null
  lead_reason: string | null
}

const stMeta: Record<string, { label: string; cor: string }> = {
  open:      { label: 'Em andamento', cor: 'var(--c-yellow)' },
  resolved:  { label: 'Finalizada',   cor: 'var(--c-green)' },
  escalated: { label: 'Com humano',   cor: 'var(--c-red)' },
}
const intMeta: Record<string, { label: string; cor: string }> = {
  qualificado: { label: 'Lead quente', cor: 'var(--c-green)' },
  potencial:   { label: 'Lead morno',  cor: 'var(--c-yellow)' },
  curioso:     { label: 'Pesquisando', cor: 'var(--c-muted)' },
}

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}
function tempo(ts: string): string {
  const d = Date.now() - new Date(ts).getTime(), m = Math.floor(d / 60000)
  if (m < 1) return 'agora'; if (m < 60) return `há ${m}min`
  const h = Math.floor(m / 60); if (h < 24) return `há ${h}h`
  return `há ${Math.floor(h / 24)}d`
}
function resumoDe(c: Conv): string {
  if (c.status === 'escalated') return 'Conversa encaminhada para atendimento humano.'
  if (c.lead_reason) return c.lead_reason
  if (c.lead_status === 'qualificado') return 'Cliente demonstrou forte interesse de compra.'
  if (c.lead_status === 'potencial') return 'Cliente demonstrou interesse, mas ainda não confirmou.'
  if (c.lead_status === 'curioso') return 'Cliente apenas pesquisando informações.'
  if (c.status === 'resolved') return 'Atendimento concluído pelo agente.'
  return 'Atendimento em andamento.'
}

export function ConversasCentral({ conversas, termos }: { conversas: Conv[]; termos: string[] }) {
  const [lista, setLista] = useState<Conv[]>(conversas)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [canal, setCanal] = useState('all')
  const [periodo, setPeriodo] = useState('all')
  const [intencao, setIntencao] = useState('all')
  const [resumos, setResumos] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string>('')

  const canais = useMemo(() => Array.from(new Set(lista.map(c => c.channel).filter(Boolean))), [lista])
  const total = lista.length
  const andamento = lista.filter(c => c.status === 'open').length
  const finalizadas = lista.filter(c => c.status === 'resolved').length
  const comHumano = lista.filter(c => c.status === 'escalated').length
  const quentes = lista.filter(c => c.lead_status === 'qualificado').length
  const todayStart = new Date(new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' })).getTime()
  const finalizadasHoje = lista.filter(c => c.status === 'resolved' && c.ended_at && new Date(c.ended_at).getTime() >= todayStart).length

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase(), agora = Date.now()
    const janela = periodo === 'hoje' ? agora - todayStart : periodo === '7' ? 7 * 86400000 : periodo === '30' ? 30 * 86400000 : null
    return lista.filter(c => {
      if (status !== 'all' && c.status !== status) return false
      if (canal !== 'all' && c.channel !== canal) return false
      if (intencao !== 'all' && (c.lead_status ?? 'none') !== intencao) return false
      if (janela && agora - new Date(c.started_at).getTime() > janela) return false
      if (termo && !`${formatContact(c.contact_identifier)} ${resumoDe(c)} ${c.contact_identifier ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
  }, [lista, q, status, canal, periodo, intencao])

  async function acao(id: string, action: string) {
    setBusy(id + action)
    const res = await fetch('/api/painel/conversa-acao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: id, action }) })
    const data = await res.json(); setBusy('')
    if (!res.ok) { alert(data.error || 'Erro.'); return }
    setLista(prev => prev.map(c => c.id === id ? { ...c, ...data.patch } : c))
  }
  async function resumir(id: string) {
    setBusy(id + 'resumir')
    const res = await fetch('/api/painel/resumo-conversa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: id }) })
    const data = await res.json(); setBusy('')
    if (!res.ok) { alert(data.error || 'Erro.'); return }
    setResumos(prev => ({ ...prev, [id]: data.summary }))
  }

  function exportar() {
    const head = ['Contato', 'Canal', 'Status', 'Intencao', 'Resumo', 'Mensagens', 'Ultima atividade']
    const rows = filtradas.map(c => [formatContact(c.contact_identifier), c.channel, stMeta[c.status]?.label ?? c.status, intMeta[c.lead_status ?? '']?.label ?? '—', resumos[c.id] || resumoDe(c), String(c.message_count ?? 0), new Date(c.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })])
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `conversas-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const cards = [
    { label: 'Total', value: total, cor: 'var(--c-blue-b)', desc: 'Todas as conversas registradas pelo agente.' },
    { label: 'Em andamento', value: andamento, cor: 'var(--c-yellow)', desc: 'Conversas abertas ou aguardando continuidade.' },
    { label: 'Finalizadas', value: finalizadas, cor: 'var(--c-green)', desc: 'Atendimentos concluídos pelo agente.' },
    { label: 'Com humano', value: comHumano, cor: 'var(--c-red)', desc: 'Conversas encaminhadas para sua equipe.' },
  ]

  const insights: string[] = []
  if (termos.length) insights.push(`Clientes perguntaram sobre ${termos.join(', ')}.`)
  if (quentes > 0) insights.push(`${quentes} conversa${quentes > 1 ? 's' : ''} com sinal de intenção comercial.`)
  if (lista.some(c => (c.message_count ?? 0) > 15)) insights.push('Conversas com muitas mensagens podem precisar de revisão.')
  if (comHumano > 0) insights.push('A IA recomenda revisar primeiro as conversas com humano.')
  if (!insights.length) insights.push('Ainda coletando dados — os insights aparecem após algumas conversas.')

  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties
  const fieldSm: React.CSSProperties = { width: 'auto', fontSize: 12, padding: '8px 10px' }

  return (
    <div className="cv-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.3fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>

      {/* ESQUERDA */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Cards */}
        <div className="cv-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {cards.map(c => (
            <div key={c.label} style={CARD}>
              <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{c.label}</p>
              <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 30, color: c.cor, letterSpacing: '-0.03em', lineHeight: 1 }}>{c.value}</p>
              <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Alerta */}
        {(comHumano > 0 || andamento > 0) && (
          <div style={{ ...CARD, borderColor: 'rgba(245,158,11,0.35)', background: 'rgba(245,158,11,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, fontWeight: 300 }}>
              {comHumano > 0 && <><b style={{ fontWeight: 600 }}>{comHumano}</b> {comHumano > 1 ? 'conversas foram encaminhadas' : 'conversa foi encaminhada'} para humano e {comHumano > 1 ? 'podem precisar' : 'pode precisar'} de resposta da equipe. </>}
              {andamento > 0 && <>{comHumano > 0 ? `${andamento} ` : <b style={{ fontWeight: 600 }}>{andamento} </b>}{andamento > 1 ? 'conversas ainda estão' : 'conversa ainda está'} em andamento.</>}
            </p>
            {comHumano > 0 && <button onClick={() => setStatus('escalated')} className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px', color: 'var(--c-yellow)', flexShrink: 0 }}>Ver conversas com humano</button>}
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por contato, mensagem ou assunto…" style={{ flex: 1, minWidth: 180 }} />
          <select className="field" value={status} onChange={e => setStatus(e.target.value)} style={fieldSm}>
            <option value="all">Todos os status</option><option value="open">Em andamento</option><option value="resolved">Finalizada</option><option value="escalated">Com humano</option>
          </select>
          {canais.length > 1 && (
            <select className="field" value={canal} onChange={e => setCanal(e.target.value)} style={fieldSm}>
              <option value="all">Todos os canais</option>{canais.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <select className="field" value={periodo} onChange={e => setPeriodo(e.target.value)} style={fieldSm}>
            <option value="all">Qualquer data</option><option value="hoje">Hoje</option><option value="7">7 dias</option><option value="30">30 dias</option>
          </select>
          <select className="field" value={intencao} onChange={e => setIntencao(e.target.value)} style={fieldSm}>
            <option value="all">Todas intenções</option><option value="qualificado">Lead quente</option><option value="potencial">Lead morno</option><option value="curioso">Apenas pesquisando</option>
          </select>
          <button onClick={exportar} className="btn-ghost" style={{ fontSize: 12, padding: '9px 14px' }}>⬇ Exportar</button>
        </div>

        {/* Tabela */}
        <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflowX: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr 1fr 2fr 0.7fr 0.9fr 1.3fr', gap: 12, padding: '10px 18px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
              {['Contato', 'Canal', 'Status', 'Intenção', 'Resumo', 'Msgs', 'Atividade', 'Ações'].map(h => (
                <span key={h} style={{ fontFamily: FONT.jb, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint }}>{h}</span>
              ))}
            </div>
            {!filtradas.length && <div style={{ padding: '48px 18px', textAlign: 'center', ...T.sub }}>Nenhuma conversa com esses filtros.</div>}
            {filtradas.map(c => {
              const st = stMeta[c.status] ?? { label: c.status, cor: C.muted }
              const it = intMeta[c.lead_status ?? '']
              return (
                <div key={c.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 1fr 1fr 2fr 0.7fr 0.9fr 1.3fr', gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 13.5, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatContact(c.contact_identifier)}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.muted }}>{c.channel}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 9, color: st.cor, padding: '3px 8px', borderRadius: 100, width: 'fit-content', background: `color-mix(in oklch, ${st.cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${st.cor} 26%, transparent)` }}>{st.label}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 10, color: it ? it.cor : C.faint }}>{it ? it.label : '—'}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, fontWeight: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={resumos[c.id] || resumoDe(c)}>{resumos[c.id] || resumoDe(c)}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{c.message_count ?? 0}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint }}>{tempo(c.started_at)}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={`/painel/conversas/${c.id}`} style={{ fontFamily: FONT.jb, fontSize: 10, color: C.blueB }}>Ver</a>
                    <button onClick={() => resumir(c.id)} disabled={busy === c.id + 'resumir'} style={btnLink}>{busy === c.id + 'resumir' ? '…' : 'Resumir'}</button>
                    {c.lead_status !== 'qualificado' && <button onClick={() => acao(c.id, 'marcar_lead')} disabled={busy === c.id + 'marcar_lead'} style={btnLink}>Marcar lead</button>}
                    {c.status !== 'resolved' && <button onClick={() => acao(c.id, 'finalizar')} disabled={busy === c.id + 'finalizar'} style={{ ...btnLink, color: 'var(--c-green)' }}>Finalizar</button>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* DIREITA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div style={CARD}>
          <h2 style={sideTitle}>Resumo rápido</h2>
          {[[`${total} conversas no total`, 'var(--c-blue-b)'], [`${andamento} em andamento`, 'var(--c-yellow)'], [`${comHumano} com humano`, 'var(--c-red)'], [`${finalizadas} finalizadas`, 'var(--c-green)'], [`Canal principal: ${canais[0] ?? 'WhatsApp'}`, 'var(--c-muted)']].map(([t, c], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c as string, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span>
            </div>
          ))}
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Atenção necessária</h2>
          {[
            comHumano > 0 && `${comHumano} ${comHumano > 1 ? 'conversas aguardam' : 'conversa aguarda'} equipe`,
            andamento > 0 && `${andamento} ${andamento > 1 ? 'conversas ainda estão abertas' : 'conversa ainda está aberta'}`,
            `${finalizadasHoje} ${finalizadasHoje === 1 ? 'conversa finalizada' : 'conversas finalizadas'} hoje`,
            quentes > 0 && `${quentes} ${quentes > 1 ? 'conversas podem representar oportunidade' : 'conversa pode representar oportunidade'} comercial`,
          ].filter(Boolean).map((t, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--c-yellow)', flexShrink: 0 }} />
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t as string}</span>
            </div>
          ))}
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Insights das conversas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 9 }}>
                <span style={{ color: 'oklch(80% 0.16 215)', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>✦</span>
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.5 }}>{ins}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Ações rápidas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => setStatus('escalated')} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Ver conversas com humano<span style={{ color: C.faint }}>→</span></button>
            <button onClick={() => setStatus('open')} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Ver conversas em andamento<span style={{ color: C.faint }}>→</span></button>
            <button onClick={exportar} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Exportar conversas<span style={{ color: C.faint }}>⬇</span></button>
            <a href="/painel/metricas" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Ver relatório do dia<span style={{ color: C.faint }}>→</span></a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1040px){ .cv-grid{ grid-template-columns: 1fr !important; } }
        @media (max-width: 620px){ .cv-cards{ grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}

const btnLink: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-jb)', fontSize: 10, color: 'var(--c-muted)', padding: 0 }
