'use client'

import { Fragment, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'
import { BarChart, RankBars, type Bar } from '@/components/BarChart'
import type { Deal } from '@/components/NegociosCentral'

const brl = (n: number) => 'R$ ' + Math.round(n).toLocaleString('pt-BR')
function parseValor(v?: string | null): number {
  if (!v) return 0
  const nums = (String(v).match(/\d[\d.]*/g) || []).map(s => parseInt(s.replace(/\./g, ''), 10)).filter(n => n >= 10)
  return nums.length ? Math.max(...nums) : 0
}
const fmtDT = (s?: string | null) => s ? new Date(s).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
const dataDe = (d: Deal) => d.confirmed_at || d.detected_at || null
const linkSt: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-jb)', fontSize: 10.5, color: 'var(--c-muted)', padding: 0 }

function statusMeta(d: Deal): { label: string; variant: 'green' | 'yellow' | 'red' | 'muted' | 'blue' } {
  if (d.status === 'confirmed') return parseValor(d.valor) > 0 ? { label: 'Confirmada', variant: 'green' } : { label: 'Valor pendente', variant: 'yellow' }
  if (d.status === 'pending') return { label: 'Aguardando pagamento', variant: 'yellow' }
  if (d.status === 'estornada') return { label: 'Estornada', variant: 'red' }
  if (d.status === 'rejected') return { label: 'Cancelada', variant: 'muted' }
  return { label: d.status, variant: 'muted' }
}

export function FaturamentoCentral({ deals, convMap, agentId, agentName, config }: {
  deals: Deal[]; convMap: Record<string, string>; agentId: string; agentName: string; config: any
}) {
  const supabase = createClient()
  const [lista, setLista] = useState<Deal[]>(deals)
  const [fStatus, setFStatus] = useState('')
  const [fProduto, setFProduto] = useState('')
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(novaVenda())
  const [editId, setEditId] = useState('')
  const [edit, setEdit] = useState<any>({})
  const [busy, setBusy] = useState('')
  const [meta, setMeta] = useState<number>(Number(config?.faturamento_meta) || 0)
  const [metaEdit, setMetaEdit] = useState(false)
  const [toasts, setToasts] = useState<{ id: number; ok: boolean; t: string }[]>([])
  function toast(t: string, ok = true) { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, ok, t }]); setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 5000) }

  const agora = Date.now()
  const nowSp = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const inicioHoje = new Date(`${nowSp}T03:00:00.000Z`).getTime()
  const inicioMes = new Date(`${nowSp.slice(0, 7)}-01T03:00:00.000Z`).getTime()
  const inicioMesAnt = new Date(new Date(inicioMes).setMonth(new Date(inicioMes).getMonth() - 1)).getTime()

  // ── KPIs ──
  const k = useMemo(() => {
    const conf = lista.filter(d => d.status === 'confirmed')
    const comValor = conf.filter(d => parseValor(d.valor) > 0)
    const fatNo = (since: number, until = Infinity) => comValor.reduce((s, d) => { const t = dataDe(d) ? new Date(dataDe(d)!).getTime() : 0; return (t >= since && t < until) ? s + parseValor(d.valor) : s }, 0)
    const total = comValor.reduce((s, d) => s + parseValor(d.valor), 0)
    const mes = fatNo(inicioMes)
    const mesAnt = fatNo(inicioMesAnt, inicioMes)
    const cresc = mesAnt > 0 ? Math.round(((mes - mesAnt) / mesAnt) * 100) : (mes > 0 ? 100 : 0)
    const pendentes = conf.filter(d => parseValor(d.valor) === 0).length
    const cancelado = lista.filter(d => d.status === 'rejected' || d.status === 'estornada').reduce((s, d) => s + parseValor(d.valor), 0)
    return {
      hoje: fatNo(inicioHoje), sete: fatNo(agora - 7 * 86400000), mes, total,
      qtd: conf.length, ticket: comValor.length ? total / comValor.length : 0,
      pendentes, cancelado, cresc,
      metaPct: meta > 0 ? Math.round((mes / meta) * 100) : 0,
    }
  }, [lista, meta])

  // ── Gráficos ──
  const porDia: Bar[] = useMemo(() => {
    const dias: Record<string, number> = {}
    for (let i = 29; i >= 0; i--) dias[new Date(agora - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })] = 0
    for (const d of lista) { if (d.status !== 'confirmed') continue; const t = dataDe(d); if (!t) continue; const key = new Date(t).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); if (key in dias) dias[key] += parseValor(d.valor) }
    const keys = Object.keys(dias)
    return keys.map((key, i) => ({ label: (i % 5 === 0) ? `${key.slice(8)}/${key.slice(5, 7)}` : '', value: Math.round(dias[key]) }))
  }, [lista])

  const porProduto: Bar[] = useMemo(() => {
    const m: Record<string, number> = {}
    for (const d of lista) { if (d.status !== 'confirmed') continue; const p = (d.produto || 'Sem produto').trim(); m[p] = (m[p] || 0) + parseValor(d.valor) }
    return Object.entries(m).map(([label, value]) => ({ label, value: Math.round(value) })).filter(b => b.value > 0).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [lista])

  // ── Tabela (filtros) ──
  const produtos = useMemo(() => Array.from(new Set(lista.map(d => d.produto).filter(Boolean))) as string[], [lista])
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista.filter(d => {
      if (fStatus) {
        if (fStatus === 'confirmada' && !(d.status === 'confirmed' && parseValor(d.valor) > 0)) return false
        if (fStatus === 'pendente' && !(d.status === 'confirmed' && parseValor(d.valor) === 0)) return false
        if (fStatus === 'aguardando' && d.status !== 'pending') return false
        if (fStatus === 'cancelada' && d.status !== 'rejected') return false
        if (fStatus === 'estornada' && d.status !== 'estornada') return false
      }
      if (fProduto && d.produto !== fProduto) return false
      if (q && ![d.empresa, d.contato_nome, d.contact_identifier].some(v => String(v || '').toLowerCase().includes(q))) return false
      return true
    }).sort((a, b) => (new Date(dataDe(b) || 0).getTime()) - (new Date(dataDe(a) || 0).getTime()))
  }, [lista, fStatus, fProduto, busca])

  // ── Ações ──
  async function salvarMeta() {
    setBusy('meta')
    const novaConfig = { ...(config || {}), faturamento_meta: meta }
    const { error } = await supabase.from('agents').update({ config: novaConfig }).eq('id', agentId)
    setBusy(''); setMetaEdit(false)
    if (error) toast(error.message, false); else toast('Meta salva.')
  }
  async function setStatus(id: string, status: string) {
    setBusy(id + status)
    const patch: any = { status }
    if (status === 'confirmed') patch.confirmed_at = new Date().toISOString()
    const { error } = await supabase.from('deals').update(patch).eq('id', id)
    setBusy('')
    if (error) { toast(error.message, false); return }
    setLista(p => p.map(d => d.id === id ? { ...d, ...patch } : d))
  }
  function abrirEdit(d: Deal) { setEditId(d.id); setEdit({ empresa: d.empresa || '', contato_nome: d.contato_nome || '', produto: d.produto || '', valor: d.valor || '', forma_pagamento: d.forma_pagamento || '', status: d.status, resumo: d.resumo || '' }) }
  async function salvarEdit(id: string) {
    setBusy(id + 'save')
    const patch: any = { ...edit, confirmed_at: edit.status === 'confirmed' ? new Date().toISOString() : null }
    let { error } = await supabase.from('deals').update(patch).eq('id', id)
    if (error && /forma_pagamento|column/i.test(error.message)) { delete patch.forma_pagamento; ({ error } = await supabase.from('deals').update(patch).eq('id', id)) }
    setBusy('')
    if (error) { toast(error.message, false); return }
    setLista(p => p.map(d => d.id === id ? { ...d, ...patch } : d)); setEditId(''); toast('Venda atualizada.')
  }
  async function adicionar() {
    setBusy('add')
    const res = await fetch('/api/painel/venda', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json().catch(() => ({}))
    setBusy('')
    if (!res.ok) { toast(data.error || 'Não foi possível registrar a venda.', false); return }
    setLista(p => [data.deal as Deal, ...p]); setShowForm(false); setForm(novaVenda()); toast('Venda registrada.')
  }
  function exportarCSV() {
    const head = ['Cliente', 'Contato', 'Telefone', 'Produto', 'Valor', 'Forma pagamento', 'Status', 'Data']
    const rows = filtrados.map(d => [d.empresa || '', d.contato_nome || '', d.contact_identifier || '', d.produto || '', d.valor || '', d.forma_pagamento || '', statusMeta(d).label, fmtDT(dataDe(d))])
    const csv = [head, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = `faturamento-${nowSp}.csv`; a.click(); URL.revokeObjectURL(url)
  }

  const kpis = [
    { l: 'Faturamento hoje', v: brl(k.hoje), c: 'var(--c-green)' },
    { l: 'Últimos 7 dias', v: brl(k.sete), c: 'var(--c-green)' },
    { l: 'Mês atual', v: brl(k.mes), c: 'var(--c-green)', sub: `${k.cresc >= 0 ? '▲' : '▼'} ${Math.abs(k.cresc)}% vs mês anterior` },
    { l: 'Faturamento total', v: brl(k.total), c: 'var(--c-blue-b)' },
    { l: 'Vendas', v: String(k.qtd), c: 'var(--c-blue-b)' },
    { l: 'Ticket médio', v: brl(k.ticket), c: 'var(--c-blue-b)' },
    { l: 'Valor pendente', v: String(k.pendentes), c: 'var(--c-yellow)', sub: 'vendas sem valor' },
    { l: 'Cancelado / estornado', v: brl(k.cancelado), c: 'var(--c-red)' },
  ]

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={T.h1}>Faturamento</h1>
          <p style={{ ...T.sub, marginTop: 4 }}>Quanto o seu agente está gerando em vendas — em tempo real.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => { setShowForm(s => !s); if (!showForm) setForm(novaVenda()) }} className="btn-primary" style={{ fontSize: 13 }}>{showForm ? 'Fechar' : '+ Nova venda'}</button>
          <button onClick={exportarCSV} className="btn-ghost" style={{ fontSize: 13 }}>⬇ CSV</button>
          <button onClick={() => window.print()} className="btn-ghost" style={{ fontSize: 13 }}>⬇ PDF</button>
        </div>
      </div>

      {showForm && <VendaForm form={form} setForm={setForm} onSave={adicionar} busy={busy === 'add'} onCancel={() => setShowForm(false)} />}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 16 }} className="fat-kpis">
        {kpis.map(kp => (
          <div key={kp.l} style={{ ...CARD, borderColor: `color-mix(in oklch, ${kp.c} 22%, var(--c-border))` }}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{kp.l}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 24, color: kp.c, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{kp.v}</p>
            {kp.sub && <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, marginTop: 6 }}>{kp.sub}</p>}
          </div>
        ))}
      </div>

      {/* Meta */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white }}>Meta de faturamento (mês)</h2>
          {metaEdit ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="field" type="number" value={meta} onChange={e => setMeta(Number(e.target.value))} style={{ width: 140, fontSize: 13 }} />
              <button onClick={salvarMeta} disabled={busy === 'meta'} className="btn-primary" style={{ fontSize: 12 }}>{busy === 'meta' ? '…' : 'Salvar'}</button>
            </div>
          ) : (
            <button onClick={() => setMetaEdit(true)} className="btn-ghost" style={{ fontSize: 12 }}>{meta > 0 ? 'Editar meta' : 'Definir meta'}</button>
          )}
        </div>
        {meta > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{brl(k.mes)} de {brl(meta)}</span>
              <span style={{ fontFamily: FONT.jb, fontSize: 12, color: k.metaPct >= 100 ? 'var(--c-green)' : 'var(--c-blue-b)' }}>{k.metaPct}%</span>
            </div>
            <div style={{ height: 10, background: C.void, borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(k.metaPct, 100)}%`, height: '100%', background: k.metaPct >= 100 ? 'var(--c-green)' : 'var(--c-blue-b)', borderRadius: 100 }} />
            </div>
          </>
        )}
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 16 }} className="fat-charts">
        <div style={CARD}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 4 }}>Faturamento por dia</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 10 }}>Últimos 30 dias (R$).</p>
          <BarChart data={porDia} color="var(--c-green)" height={150} />
        </div>
        <div style={CARD}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 10 }}>Por produto / serviço</h2>
          <RankBars data={porProduto} color="var(--c-blue-b)" suffix="" />
        </div>
      </div>

      {/* Filtros */}
      <div style={{ ...CARD, padding: '12px 14px', marginBottom: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="field" placeholder="Buscar nome ou telefone…" value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 200, fontSize: 12.5 }} />
        <select className="field" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 'auto', fontSize: 12.5 }}>
          <option value="">Todos status</option>
          <option value="confirmada">Confirmada</option>
          <option value="aguardando">Aguardando pagamento</option>
          <option value="pendente">Valor pendente</option>
          <option value="cancelada">Cancelada</option>
          <option value="estornada">Estornada</option>
        </select>
        <select className="field" value={fProduto} onChange={e => setFProduto(e.target.value)} style={{ width: 'auto', fontSize: 12.5 }}>
          <option value="">Todos produtos</option>
          {produtos.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <span style={{ ...T.sub, fontSize: 12, marginLeft: 'auto' }}>{filtrados.length} registro(s)</span>
      </div>

      {/* Tabela */}
      <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
          <thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>
            {['Cliente', 'Produto / serviço', 'Valor', 'Pagamento', 'Status', 'Data', 'Ações'].map(h => <th key={h} style={{ ...T.mono, color: C.faint, fontSize: 9, textAlign: 'left', padding: '12px 14px', whiteSpace: 'nowrap' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {filtrados.length === 0 && <tr><td colSpan={7} style={{ padding: '48px 14px', textAlign: 'center', ...T.sub }}>Nenhuma venda registrada ainda. Vendas confirmadas pela IA aparecem aqui automaticamente.</td></tr>}
            {filtrados.map(d => {
              const meta2 = statusMeta(d); const conv = convMap[d.contact_identifier || ''] || ''
              const editing = editId === d.id; const v = parseValor(d.valor)
              return (
                <Fragment key={d.id}>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={tdS(C.white, 500)}>{d.empresa || d.contato_nome || '—'}</td>
                    <td style={tdS()}>{d.produto || '—'}</td>
                    <td style={tdS(v > 0 ? 'var(--c-green)' : 'var(--c-yellow)', 500)}>{v > 0 ? brl(v) : 'pendente'}</td>
                    <td style={tdS()}>{d.forma_pagamento || '—'}</td>
                    <td style={{ ...tdS(), whiteSpace: 'nowrap' }}><span style={badgeStyle(meta2.variant)}>{meta2.label}</span></td>
                    <td style={tdS()}>{fmtDT(dataDe(d))}</td>
                    <td style={{ ...tdS(), whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                        {conv && <a href={`/painel/conversas/${conv}`} style={linkSt}>Conversa</a>}
                        <button onClick={() => abrirEdit(d)} style={linkSt}>Editar</button>
                        {d.status === 'pending' && <button onClick={() => setStatus(d.id, 'confirmed')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Confirmar pagamento</button>}
                        {d.status === 'confirmed' && <button onClick={() => setStatus(d.id, 'estornada')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Estornar</button>}
                        {!['rejected', 'estornada'].includes(d.status) && <button onClick={() => setStatus(d.id, 'rejected')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Cancelar</button>}
                      </div>
                    </td>
                  </tr>
                  {editing && (
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.void }}>
                      <td colSpan={7} style={{ padding: 16 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 }}>
                          {[['empresa', 'Cliente'], ['produto', 'Produto / serviço'], ['valor', 'Valor'], ['forma_pagamento', 'Forma de pagamento']].map(([key, lbl]) => (
                            <div key={key}><label style={T.label}>{lbl}</label><input className="field" value={edit[key]} onChange={e => setEdit({ ...edit, [key]: e.target.value })} /></div>
                          ))}
                          <div><label style={T.label}>Status</label>
                            <select className="field" value={edit.status} onChange={e => setEdit({ ...edit, status: e.target.value })}>
                              {[['confirmed', 'Confirmada'], ['pending', 'Aguardando pagamento'], ['rejected', 'Cancelada'], ['estornada', 'Estornada']].map(([vv, l]) => <option key={vv} value={vv}>{l}</option>)}
                            </select>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => salvarEdit(d.id)} disabled={busy === d.id + 'save'} className="btn-primary" style={{ fontSize: 12 }}>{busy === d.id + 'save' ? 'Salvando…' : 'Salvar'}</button>
                          <button onClick={() => setEditId('')} className="btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {toasts.length > 0 && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 340 }}>
          {toasts.map(t => (
            <div key={t.id} style={{ background: C.deep, border: `1px solid ${t.ok ? 'rgba(34,197,94,0.4)' : 'rgba(232,64,64,0.4)'}`, borderLeft: `3px solid ${t.ok ? 'var(--c-green)' : 'var(--c-red)'}`, borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10 }}>
              <span style={{ color: t.ok ? 'var(--c-green)' : 'var(--c-red)' }}>{t.ok ? '✓' : '⚠'}</span>
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>{t.t}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width:980px){ .fat-kpis{ grid-template-columns: repeat(2,1fr) !important } .fat-charts{ grid-template-columns: 1fr !important } }
      `}</style>
    </div>
  )
}

function tdS(color = 'var(--c-muted)', weight = 400): React.CSSProperties {
  return { padding: '11px 14px', fontFamily: 'var(--font-dm)', fontSize: 13, color, fontWeight: weight as any, verticalAlign: 'top' }
}
function novaVenda() { return { cliente: '', contato: '', telefone: '', produto: '', valor: '', forma_pagamento: '', status: 'confirmed', observacoes: '' } }

function VendaForm({ form, setForm, onSave, busy, onCancel }: { form: any; setForm: (f: any) => void; onSave: () => void; busy: boolean; onCancel: () => void }) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v })
  const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>{children}</div>
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div><label style={T.label}>{label}</label>{children}</div>
  return (
    <div style={{ ...CARD, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Row>
        <F label="Cliente"><input className="field" value={form.cliente} onChange={e => set('cliente', e.target.value)} /></F>
        <F label="Contato (nome)"><input className="field" value={form.contato} onChange={e => set('contato', e.target.value)} /></F>
        <F label="Telefone"><input className="field" value={form.telefone} onChange={e => set('telefone', e.target.value)} placeholder="5511999999999" /></F>
      </Row>
      <Row>
        <F label="Produto / serviço"><input className="field" value={form.produto} onChange={e => set('produto', e.target.value)} /></F>
        <F label="Valor (R$)"><input className="field" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="200" /></F>
        <F label="Forma de pagamento"><input className="field" value={form.forma_pagamento} onChange={e => set('forma_pagamento', e.target.value)} placeholder="Pix, cartão…" /></F>
        <F label="Status"><select className="field" value={form.status} onChange={e => set('status', e.target.value)}>{[['confirmed', 'Confirmada'], ['pending', 'Aguardando pagamento']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></F>
      </Row>
      <F label="Observações"><textarea className="field" rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} /></F>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave} disabled={busy} className="btn-primary" style={{ fontSize: 12 }}>{busy ? 'Salvando…' : 'Registrar venda'}</button>
        <button onClick={onCancel} className="btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
      </div>
    </div>
  )
}
