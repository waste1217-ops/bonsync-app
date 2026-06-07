'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'

export interface Deal {
  id: string
  empresa: string | null
  contato_nome: string | null
  contact_identifier: string | null
  produto: string | null
  volume: string | null
  valor: string | null
  resumo: string | null
  status: string
  detected_at: string | null
  confirmed_at: string | null
}
interface Funnel { conversas: number; leads: number; oportunidades: number; vendas: number }

const stMeta: Record<string, { label: string; cor: string }> = {
  confirmed:  { label: 'Venda confirmada',       cor: 'var(--c-green)' },
  pending:    { label: 'Aguardando confirmação', cor: 'var(--c-yellow)' },
  proposta:   { label: 'Proposta enviada',       cor: 'var(--c-blue-b)' },
  negociacao: { label: 'Em negociação',          cor: 'var(--c-muted)' },
  rejected:   { label: 'Perdido',                cor: 'var(--c-red)' },
}
const proximoPasso: Record<string, string> = {
  confirmed:  'Enviar contrato ou alinhar o início da operação.',
  pending:    'Validar o interesse e confirmar o fechamento.',
  proposta:   'Acompanhar o retorno da proposta enviada.',
  negociacao: 'Negociar condições e avançar para o fechamento.',
  rejected:   'Negócio encerrado. Reabra se houver novo interesse.',
}
const STATUS_OPTS = [['pending', 'Aguardando confirmação'], ['confirmed', 'Confirmado'], ['proposta', 'Proposta enviada'], ['negociacao', 'Em negociação'], ['rejected', 'Perdido']]

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR')
function parseRange(valor: string | null): [number, number] | null {
  if (!valor) return null
  const nums = (valor.match(/\d[\d.]*/g) || []).map(s => parseInt(s.replace(/\./g, ''), 10)).filter(n => n >= 100)
  if (!nums.length) return null
  return [Math.min(...nums), Math.max(...nums)]
}
function rangeLabel(min: number, max: number): string {
  if (!max) return '—'
  return min === max ? `${brl(max)}/mês` : `${brl(min)} a ${brl(max)}/mês`
}

export function NegociosCentral({ deals, funnel, convMap }: { deals: Deal[]; funnel: Funnel; convMap: Record<string, string> }) {
  const supabase = createClient()
  const [lista, setLista] = useState<Deal[]>(deals)
  const [busy, setBusy] = useState('')
  const [editId, setEditId] = useState('')
  const [edit, setEdit] = useState<any>({})
  const [propostas, setPropostas] = useState<Record<string, string>>({})

  const confirmados = lista.filter(d => d.status === 'confirmed')
  const pendentes = lista.filter(d => d.status === 'pending')
  const emValidacao = lista.filter(d => d.status === 'pending' || d.status === 'proposta' || d.status === 'negociacao')

  // Valor estimado (soma das faixas dos confirmados)
  let totMin = 0, totMax = 0, comValor = 0
  for (const d of confirmados) { const r = parseRange(d.valor); if (r) { totMin += r[0]; totMax += r[1]; comValor++ } }
  const receita = comValor ? rangeLabel(totMin, totMax) : '—'
  const ticket = comValor ? rangeLabel(Math.round(totMin / comValor), Math.round(totMax / comValor)) : '—'

  const cards = [
    { label: 'Vendas fechadas', value: String(confirmados.length), cor: 'var(--c-green)', desc: 'Clientes confirmados pela equipe.' },
    { label: 'Valor estimado', value: receita, cor: 'var(--c-green)', desc: 'Receita mensal potencial detectada.', small: true },
    { label: 'Aguardando confirmação', value: String(pendentes.length), cor: 'var(--c-yellow)', desc: 'Oportunidades que precisam ser validadas.' },
    { label: 'Ticket médio', value: ticket, cor: 'var(--c-blue-b)', desc: 'Média estimada por cliente fechado.', small: true },
  ]

  async function setStatus(id: string, status: string) {
    setBusy(id + status)
    const patch: any = { status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null }
    const { error } = await supabase.from('deals').update(patch).eq('id', id)
    setBusy('')
    if (error) { alert(error.message); return }
    setLista(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))
  }
  function abrirEdit(d: Deal) { setEditId(d.id); setEdit({ empresa: d.empresa || '', produto: d.produto || '', volume: d.volume || '', valor: d.valor || '', status: d.status, resumo: d.resumo || '' }) }
  async function salvarEdit(id: string) {
    setBusy(id + 'save')
    const patch: any = { ...edit, confirmed_at: edit.status === 'confirmed' ? new Date().toISOString() : null }
    const { error } = await supabase.from('deals').update(patch).eq('id', id)
    setBusy('')
    if (error) { alert(error.message); return }
    setLista(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d)); setEditId('')
  }
  async function gerarProposta(id: string) {
    setBusy(id + 'prop')
    const res = await fetch('/api/painel/gerar-proposta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: id }) })
    const data = await res.json(); setBusy('')
    if (!res.ok) { alert(data.error || 'Erro.'); return }
    setPropostas(prev => ({ ...prev, [id]: data.proposta }))
  }
  function exportar() {
    const head = ['Empresa', 'Contato', 'Canal', 'Produto', 'Volume', 'Valor', 'Status', 'Data']
    const rows = lista.map(d => [d.empresa || '', d.contato_nome || '', 'WhatsApp', d.produto || '', d.volume || '', d.valor || '', stMeta[d.status]?.label || d.status, fmtDate(d.confirmed_at || d.detected_at)])
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `negocios-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const convOf = (d: Deal) => convMap[d.contact_identifier ?? ''] || ''
  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties

  const insights: string[] = []
  if (lista.some(d => d.volume)) insights.push('Oportunidades com volume mensal definido tendem a ter maior chance de fechamento.')
  insights.push('Clientes que informam quantidade de pedidos devem ser priorizados.')
  if (lista.length) insights.push('O canal WhatsApp gerou 100% dos negócios registrados.')
  const prodSample = lista.find(d => d.produto)?.produto
  if (prodSample) insights.push(`A IA identificou interesse em ${prodSample.toLowerCase()}.`)

  function DealCard({ d, confirmado }: { d: Deal; confirmado: boolean }) {
    const st = stMeta[d.status] ?? { label: d.status, cor: C.muted }
    const editing = editId === d.id
    const nome = d.empresa || d.contato_nome || 'Negócio'
    const conv = convOf(d)
    return (
      <div style={{ background: C.deep, border: `1px solid ${confirmado ? 'rgba(34,197,94,0.25)' : `color-mix(in oklch, ${st.cor} 26%, var(--c-border))`}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 17, color: C.white }}>{nome}</span>
            <span style={{ fontFamily: FONT.jb, fontSize: 9, color: st.cor, padding: '3px 9px', borderRadius: 100, background: `color-mix(in oklch, ${st.cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${st.cor} 28%, transparent)` }}>{st.label}</span>
          </div>
          <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint }}>{d.confirmed_at ? `Fechada em ${fmtDate(d.confirmed_at)}` : `Detectada em ${fmtDate(d.detected_at)}`}</span>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[['empresa', 'Empresa / cliente'], ['produto', 'Produto / serviço'], ['volume', 'Volume'], ['valor', 'Valor estimado']].map(([k, lbl]) => (
              <div key={k}><label style={T.label}>{lbl}</label><input className="field" value={edit[k]} onChange={e => setEdit({ ...edit, [k]: e.target.value })} /></div>
            ))}
            <div><label style={T.label}>Status</label><select className="field" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>{STATUS_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => salvarEdit(d.id)} disabled={busy === d.id + 'save'} className="btn-primary" style={{ fontSize: 12 }}>{busy === d.id + 'save' ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setEditId('')} className="btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: d.resumo ? 12 : 0 }}>
              {[['Contato', d.contato_nome], ['Canal', 'WhatsApp'], ['Produto / serviço', d.produto], ['Volume', d.volume], ['Valor estimado', d.valor], ['Status', st.label]].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string}>
                  <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>{k}</p>
                  <p style={{ fontFamily: FONT.dm, fontSize: 14, color: (k === 'Valor estimado') ? 'var(--c-green)' : C.white, fontWeight: k === 'Valor estimado' ? 500 : 400 }}>{v as string}</p>
                </div>
              ))}
            </div>
            {d.resumo && <div style={{ marginBottom: 12 }}><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>Resumo</p><p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.muted, lineHeight: 1.6, fontWeight: 300 }}>{d.resumo}</p></div>}
            <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <p style={{ ...T.mono, color: 'oklch(80% 0.12 215)', fontSize: 9, marginBottom: 4 }}>Próximo passo</p>
              <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>{proximoPasso[d.status] ?? '—'}</p>
            </div>

            {propostas[d.id] && (
              <div style={{ background: C.void, border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ ...T.mono, color: C.blueB, fontSize: 9 }}>Proposta gerada</p>
                  <button onClick={() => navigator.clipboard.writeText(propostas[d.id])} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT.jb, fontSize: 10, color: C.blueB }}>copiar</button>
                </div>
                <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{propostas[d.id]}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {conv && <a href={`/painel/conversas/${conv}`} style={linkSt}>Ver conversa</a>}
              {!confirmado && <button onClick={() => setStatus(d.id, 'confirmed')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Confirmar venda</button>}
              <button onClick={() => abrirEdit(d)} style={linkSt}>Editar negócio</button>
              <button onClick={() => gerarProposta(d.id)} disabled={busy === d.id + 'prop'} style={{ ...linkSt, color: C.blueB }}>{busy === d.id + 'prop' ? 'Gerando…' : 'Gerar proposta'}</button>
              {d.status !== 'rejected' && <button onClick={() => setStatus(d.id, 'rejected')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Marcar como perdido</button>}
            </div>
          </>
        )}
      </div>
    )
  }

  const etapas = [
    { label: 'Conversas', value: funnel.conversas, cor: 'var(--c-blue-b)' },
    { label: 'Leads', value: funnel.leads, cor: 'var(--c-yellow)' },
    { label: 'Oportunidades', value: funnel.oportunidades, cor: 'oklch(80% 0.16 215)' },
    { label: 'Vendas', value: funnel.vendas, cor: 'var(--c-green)' },
  ]

  return (
    <div className="ng-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
      {/* ESQUERDA */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Cards */}
        <div className="ng-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {cards.map(c => (
            <div key={c.label} style={{ ...CARD, borderColor: `color-mix(in oklch, ${c.cor} 22%, var(--c-border))` }}>
              <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{c.label}</p>
              <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: c.small ? 17 : 30, color: c.cor, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{c.value}</p>
              <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Funil comercial */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Funil comercial</h2>
            <button onClick={exportar} className="btn-ghost" style={{ fontSize: 11, padding: '7px 12px' }}>⬇ Exportar</button>
          </div>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 16 }}>Veja como os atendimentos evoluíram até oportunidades comerciais.</p>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
            {etapas.map((e, i) => (
              <div key={e.label} style={{ display: 'contents' }}>
                <div style={{ flex: 1, minWidth: 110, background: C.void, border: `1px solid color-mix(in oklch, ${e.cor} 24%, var(--c-border))`, borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 26, color: e.cor, lineHeight: 1 }}>{e.value}</p>
                  <p style={{ ...T.mono, fontSize: 9, color: C.muted, marginTop: 6 }}>{e.label}</p>
                </div>
                {i < etapas.length - 1 && <div style={{ display: 'flex', alignItems: 'center', color: C.faint, fontSize: 18 }}>→</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Vendas confirmadas */}
        <div>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 }}>Vendas confirmadas</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>Clientes confirmados pela equipe como venda ou fechamento.</p>
          {confirmados.length === 0 ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhuma venda confirmada ainda. Quando você confirmar uma oportunidade, ela aparece aqui.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{confirmados.map(d => <DealCard key={d.id} d={d} confirmado />)}</div>
          )}
        </div>

        {/* Oportunidades em validação */}
        <div>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 }}>Oportunidades em validação</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>Possíveis vendas detectadas pela IA que ainda precisam de confirmação.</p>
          {emValidacao.length === 0 ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhuma oportunidade aguardando confirmação no momento.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{emValidacao.map(d => <DealCard key={d.id} d={d} confirmado={false} />)}</div>
          )}
        </div>
      </div>

      {/* DIREITA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div style={CARD}>
          <h2 style={sideTitle}>Resumo comercial</h2>
          {[[`Receita estimada: ${receita}`, 'var(--c-green)'], [`Clientes fechados: ${confirmados.length}`, 'var(--c-blue-b)'], [`Em validação: ${emValidacao.length}`, 'var(--c-yellow)'], [`Ticket médio: ${ticket}`, 'var(--c-blue-b)'], [`Origem principal: WhatsApp`, 'var(--c-muted)']].map(([t, c], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c as string, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span>
            </div>
          ))}
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Insights de venda</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => <div key={i} style={{ display: 'flex', gap: 9 }}><span style={{ color: 'oklch(80% 0.16 215)', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>✦</span><span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.5 }}>{ins}</span></div>)}
          </div>
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Próximas ações</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={exportar} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between', width: '100%' }}>Exportar negócios<span style={{ color: C.faint }}>⬇</span></button>
            <a href="/painel/leads" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Revisar oportunidades<span style={{ color: C.faint }}>→</span></a>
            <a href="/painel/avaliacoes" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Criar relatório comercial<span style={{ color: C.faint }}>→</span></a>
            <a href="/painel/conversas" className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>Ver conversas<span style={{ color: C.faint }}>→</span></a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1040px){ .ng-grid{ grid-template-columns: 1fr !important; } }
        @media (max-width: 680px){ .ng-cards{ grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}

const linkSt: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-muted)', padding: 0 }
