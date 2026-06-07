'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { C, T, CARD, FONT } from '@/lib/styles'

export interface Lead {
  id: string
  contact_identifier: string | null
  channel: string
  status: string
  lead_status: string | null
  lead_reason: string | null
  started_at: string
  message_count: number
  ultimaMsg: string
  interesse: string
  pipeline: 'novo' | 'em_contato' | 'convertido' | 'perdido'
}

const tempMeta: Record<string, { label: string; cor: string }> = {
  qualificado: { label: 'Lead quente', cor: 'var(--c-green)' },
  potencial:   { label: 'Lead morno',  cor: 'var(--c-yellow)' },
  curioso:     { label: 'Apenas pesquisando', cor: 'var(--c-muted)' },
  sem:         { label: 'Aguardando IA', cor: 'var(--c-blue-b)' },
}
const tkey = (l: Lead) => l.lead_status && tempMeta[l.lead_status] ? l.lead_status : 'sem'

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}
function motivoDe(l: Lead): string {
  if (l.lead_reason) return l.lead_reason
  if (!l.lead_status) return 'A IA ainda não analisou a intenção de compra.'
  if (l.lead_status === 'qualificado') return 'Demonstrou forte interesse de compra.'
  if (l.lead_status === 'potencial') return 'Solicitou informações, mas ainda não confirmou.'
  return 'Apenas pesquisou informações gerais.'
}

export function LeadsCentral({ leads, termos }: { leads: Lead[]; termos: { termo: string; n: number }[] }) {
  const router = useRouter()
  const [lista, setLista] = useState<Lead[]>(leads)
  const [q, setQ] = useState('')
  const [temp, setTemp] = useState('all')
  const [origem, setOrigem] = useState('all')
  const [periodo, setPeriodo] = useState('all')
  const [pipe, setPipe] = useState('all')
  const [sortMsgs, setSortMsgs] = useState(false)
  const [busy, setBusy] = useState('')

  const canais = useMemo(() => Array.from(new Set(lista.map(l => l.channel).filter(Boolean))), [lista])
  const quentes = lista.filter(l => l.lead_status === 'qualificado').length
  const mornos = lista.filter(l => l.lead_status === 'potencial').length
  const pesquisando = lista.filter(l => l.lead_status === 'curioso').length
  const aguardando = lista.filter(l => !l.lead_status).length
  const total = lista.length

  const filtradas = useMemo(() => {
    const termo = q.trim().toLowerCase(), agora = Date.now()
    const todayStart = new Date(new Date().toLocaleDateString('en-US', { timeZone: 'America/Sao_Paulo' })).getTime()
    const janela = periodo === 'hoje' ? agora - todayStart : periodo === '7' ? 7 * 86400000 : periodo === '30' ? 30 * 86400000 : null
    let r = lista.filter(l => {
      if (temp !== 'all' && tkey(l) !== temp) return false
      if (origem !== 'all' && l.channel !== origem) return false
      if (pipe !== 'all' && l.pipeline !== pipe) return false
      if (janela && agora - new Date(l.started_at).getTime() > janela) return false
      if (termo && !`${formatContact(l.contact_identifier)} ${l.interesse} ${l.ultimaMsg} ${l.contact_identifier ?? ''}`.toLowerCase().includes(termo)) return false
      return true
    })
    if (sortMsgs) r = [...r].sort((a, b) => (b.message_count ?? 0) - (a.message_count ?? 0))
    return r
  }, [lista, q, temp, origem, periodo, pipe, sortMsgs])

  async function acao(id: string, action: string) {
    setBusy(id + action)
    const res = await fetch('/api/painel/conversa-acao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: id, action }) })
    const data = await res.json(); setBusy('')
    if (!res.ok) { alert(data.error || 'Erro.'); return }
    if (data.patch) setLista(prev => prev.map(l => l.id === id ? { ...l, ...data.patch } : l))
    if (action === 'marcar_venda') { setLista(prev => prev.map(l => l.id === id ? { ...l, pipeline: 'em_contato' } : l)); alert(data.alreadyExists ? 'Já existe um negócio para este contato.' : 'Negócio criado! Confirme em Negócios.') }
  }
  async function classificar(id: string) {
    setBusy(id + 'class')
    const res = await fetch('/api/painel/classificar-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: id }) })
    const data = await res.json(); setBusy('')
    if (!res.ok) { alert(data.error || 'Erro.'); return }
    setLista(prev => prev.map(l => l.id === id ? { ...l, lead_status: data.lead_status, lead_reason: data.lead_reason } : l))
  }
  function exportar() {
    const head = ['Contato', 'Temperatura', 'Interesse', 'Motivo', 'Ultima mensagem', 'Mensagens', 'Data']
    const rows = filtradas.map(l => [formatContact(l.contact_identifier), tempMeta[tkey(l)].label, l.interesse, motivoDe(l), l.ultimaMsg, String(l.message_count ?? 0), new Date(l.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })])
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `leads-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const cards = [
    { label: 'Leads quentes', value: quentes, cor: 'var(--c-green)', desc: 'Alta intenção de compra — entre em contato agora.' },
    { label: 'Leads mornos', value: mornos, cor: 'var(--c-yellow)', desc: 'Interesse real — acompanhe nos próximos dias.' },
    { label: 'Apenas pesquisando', value: pesquisando, cor: 'var(--c-muted)', desc: 'Baixa intenção — manter no radar.' },
    { label: 'Aguardando classificação', value: aguardando, cor: 'var(--c-blue-b)', desc: 'Contatos que ainda precisam ser analisados pela IA.' },
  ]
  const insights: string[] = []
  if (aguardando > total / 2) insights.push('A maioria dos contatos ainda precisa ser classificada.')
  insights.push('Conversas com muitas mensagens podem indicar maior intenção.')
  insights.push('Leads que perguntam sobre preço e volume devem ser priorizados.')
  if (lista.some(l => (l.message_count ?? 0) > 12)) insights.push('A IA recomenda revisar os contatos com mais mensagens.')

  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties
  const fieldSm: React.CSSProperties = { width: 'auto', fontSize: 12, padding: '8px 10px' }
  const cols = '1.3fr 1fr 1.1fr 1.8fr 1.6fr 0.6fr 0.8fr 1.4fr'

  return (
    <div className="lc-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.3fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
      {/* ESQUERDA */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="lc-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {cards.map(c => (
            <div key={c.label} style={{ ...CARD, borderColor: `color-mix(in oklch, ${c.cor} 22%, var(--c-border))` }}>
              <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{c.label}</p>
              <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 30, color: c.cor, letterSpacing: '-0.03em', lineHeight: 1 }}>{c.value}</p>
              <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Prioridade de contato */}
        <div style={{ ...CARD, borderColor: quentes > 0 ? 'rgba(34,197,94,0.35)' : 'rgba(80,130,210,0.3)', background: quentes > 0 ? 'rgba(34,197,94,0.05)' : 'rgba(80,130,210,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white, fontWeight: 300, flex: 1, minWidth: 200 }}>
            {quentes > 0
              ? <><b style={{ fontWeight: 600 }}>{quentes} lead{quentes > 1 ? 's' : ''} quente{quentes > 1 ? 's' : ''}</b> precisa{quentes > 1 ? 'm' : ''} de atenção. {quentes > 1 ? 'Esses contatos demonstraram' : 'Esse contato demonstrou'} intenção de compra e {quentes > 1 ? 'devem' : 'deve'} ser {quentes > 1 ? 'atendidos' : 'atendido'} rapidamente.</>
              : <>Nenhum lead quente no momento. Existem <b style={{ fontWeight: 600 }}>{aguardando} contato{aguardando !== 1 ? 's' : ''}</b> aguardando classificação. Revise as conversas recentes para identificar novas oportunidades.</>}
          </p>
          <button onClick={() => setTemp(quentes > 0 ? 'qualificado' : 'sem')} className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px', color: quentes > 0 ? 'var(--c-green)' : 'var(--c-blue-b)', flexShrink: 0 }}>
            {quentes > 0 ? 'Ver leads prioritários' : 'Ver não classificados'}
          </button>
        </div>

        {/* Filtros */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="field" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, telefone ou interesse…" style={{ flex: 1, minWidth: 180 }} />
          <select className="field" value={temp} onChange={e => setTemp(e.target.value)} style={fieldSm}>
            <option value="all">Todas temperaturas</option><option value="qualificado">Quentes</option><option value="potencial">Mornos</option><option value="curioso">Pesquisando</option><option value="sem">Sem classificação</option>
          </select>
          {canais.length > 1 && <select className="field" value={origem} onChange={e => setOrigem(e.target.value)} style={fieldSm}><option value="all">Todas origens</option>{canais.map(c => <option key={c} value={c}>{c}</option>)}</select>}
          <select className="field" value={periodo} onChange={e => setPeriodo(e.target.value)} style={fieldSm}>
            <option value="all">Qualquer data</option><option value="hoje">Hoje</option><option value="7">7 dias</option><option value="30">30 dias</option>
          </select>
          <select className="field" value={pipe} onChange={e => setPipe(e.target.value)} style={fieldSm}>
            <option value="all">Todos status</option><option value="novo">Novo</option><option value="em_contato">Em contato</option><option value="convertido">Convertido</option><option value="perdido">Perdido</option>
          </select>
          <button onClick={exportar} className="btn-ghost" style={{ fontSize: 12, padding: '9px 14px' }}>⬇ Exportar</button>
        </div>

        {/* Tabela */}
        <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflowX: 'auto' }}>
          <div style={{ minWidth: 980 }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 18px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
              {['Contato', 'Temperatura', 'Interesse', 'Motivo', 'Última mensagem', 'Msgs', 'Data', 'Ações'].map(h => <span key={h} style={{ fontFamily: FONT.jb, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: C.faint }}>{h}</span>)}
            </div>
            {!filtradas.length && <div style={{ padding: '48px 18px', textAlign: 'center', ...T.sub }}>Nenhum lead com esses filtros.</div>}
            {filtradas.map(l => {
              const tm = tempMeta[tkey(l)]
              const semClass = !l.lead_status
              const convertido = l.pipeline === 'convertido'
              return (
                <div key={l.id} className="trow" style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 13.5, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatContact(l.contact_identifier)}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 9, color: tm.cor, padding: '3px 8px', borderRadius: 100, width: 'fit-content', background: `color-mix(in oklch, ${tm.cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${tm.cor} 26%, transparent)` }}>{tm.label}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.interesse}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: semClass ? C.faint : C.muted, fontWeight: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={motivoDe(l)}>{motivoDe(l)}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, fontWeight: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.ultimaMsg}>{l.ultimaMsg || '—'}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{l.message_count ?? 0}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint }}>{new Date(l.started_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={`/painel/conversas/${l.id}`} style={{ fontFamily: FONT.jb, fontSize: 10, color: C.blueB }}>Ver conversa</a>
                    {convertido
                      ? <a href="/painel/negocios" style={{ fontFamily: FONT.jb, fontSize: 10, color: 'var(--c-green)' }}>Ver venda</a>
                      : <>
                          {semClass && <button onClick={() => classificar(l.id)} disabled={busy === l.id + 'class'} style={{ ...btnLink, color: C.blueB }}>{busy === l.id + 'class' ? '…' : 'Classificar agora'}</button>}
                          {l.lead_status !== 'qualificado' && <button onClick={() => acao(l.id, 'marcar_lead')} disabled={busy === l.id + 'marcar_lead'} style={{ ...btnLink, color: 'var(--c-green)' }}>Marcar quente</button>}
                          <button onClick={() => acao(l.id, 'marcar_venda')} disabled={busy === l.id + 'marcar_venda'} style={btnLink}>Marcar venda</button>
                        </>}
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
          <h2 style={sideTitle}>Resumo dos leads</h2>
          {[[`Total de contatos: ${total}`, 'var(--c-blue-b)'], [`Leads quentes: ${quentes}`, 'var(--c-green)'], [`Leads mornos: ${mornos}`, 'var(--c-yellow)'], [`Apenas pesquisando: ${pesquisando}`, 'var(--c-muted)'], [`Aguardando classificação: ${aguardando}`, 'var(--c-blue-b)'], [`Origem principal: ${canais[0] ?? 'WhatsApp'}`, 'var(--c-muted)']].map(([t, c], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c as string, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span>
            </div>
          ))}
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Insights de vendas</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{ display: 'flex', gap: 9 }}><span style={{ color: 'oklch(80% 0.16 215)', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>✦</span><span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.5 }}>{ins}</span></div>
            ))}
          </div>
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Principais interesses</h2>
          {termos.length === 0 ? <p style={{ ...T.sub, fontSize: 13 }}>Ainda sem dados suficientes.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {termos.map(t => (
                <div key={t.termo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, textTransform: 'capitalize' }}>{t.termo}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.muted, background: 'rgba(80,130,210,0.1)', border: `1px solid ${C.border}`, borderRadius: 100, padding: '2px 8px' }}>{t.n}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Próximas ações</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={() => setTemp('sem')} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Revisar não classificados<span style={{ color: C.faint }}>→</span></button>
            <button onClick={() => setSortMsgs(s => !s)} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Ver com mais mensagens<span style={{ color: C.faint }}>{sortMsgs ? '✓' : '↓'}</span></button>
            <button onClick={exportar} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Exportar leads<span style={{ color: C.faint }}>⬇</span></button>
            <a href="/painel/avaliacoes" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Gerar resumo comercial<span style={{ color: C.faint }}>→</span></a>
            <button onClick={() => setTemp('potencial')} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Focar nos leads mornos<span style={{ color: C.faint }}>→</span></button>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1040px){ .lc-grid{ grid-template-columns: 1fr !important; } }
        @media (max-width: 620px){ .lc-cards{ grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}

const btnLink: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-jb)', fontSize: 10, color: 'var(--c-muted)', padding: 0 }
