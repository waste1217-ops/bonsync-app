'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'
import { AGENDA_STATUS, MODALIDADES_PEDIDO, type Segmento, type CampoExtra } from '@/lib/segmentos'

export interface AgMeeting {
  id: string; status: string
  empresa: string | null; contato_nome: string | null; contact_identifier: string | null
  assunto: string | null; observacoes: string | null; responsavel: string | null
  canal: string | null; origem: string | null; tipo: string | null
  start_at: string | null; requested_date: string | null; requested_time: string | null
  duracao_min: number | null; conversation_id: string | null; source: string | null
  campos: Record<string, any> | null
}

const fmtD = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })
const fmtT = (s?: string | null) => s ? new Date(s).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'
const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
const linkSt: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-jb)', fontSize: 10.5, color: 'var(--c-muted)', padding: 0 }

function effDate(m: AgMeeting): Date | null {
  if (m.start_at) return new Date(m.start_at)
  if (m.requested_date) return new Date(`${m.requested_date}T${(m.requested_time || '00:00')}:00-03:00`)
  return null
}

export interface ServicoItem { nome: string; valor?: string; duracao?: any }
export function AgendaCentral({ meetings, agentId, seg, campos, profissionais, servicos, servicosLista = [], unidades = [], convMap, schemaReady }: {
  meetings: AgMeeting[]; agentId: string; seg: Segmento; campos: CampoExtra[]
  profissionais: string[]; servicos: string[]; servicosLista?: ServicoItem[]; unidades?: string[]
  convMap: Record<string, string>; schemaReady: boolean
}) {
  const supabase = createClient()
  const [lista, setLista] = useState<AgMeeting[]>(meetings)
  const [view, setView] = useState<'dia' | 'semana' | 'mes'>('semana')
  const [ref, setRef] = useState(new Date())
  const [fStatus, setFStatus] = useState('')
  const [fProf, setFProf] = useState('')
  const [busca, setBusca] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<any>(novo())
  const [exp, setExp] = useState('')
  const [busy, setBusy] = useState('')
  const [toasts, setToasts] = useState<{ id: number; ok: boolean; t: string }[]>([])
  function toast(t: string, ok = true) { const id = Date.now() + Math.random(); setToasts(x => [...x, { id, ok, t }]); setTimeout(() => setToasts(x => x.filter(y => y.id !== id)), 5000) }

  // intervalo da visão
  const [from, to, periodoLabel] = useMemo<[Date, Date, string]>(() => {
    const d = new Date(ref); d.setHours(0, 0, 0, 0)
    if (view === 'dia') { const e = new Date(d); e.setDate(e.getDate() + 1); return [d, e, d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })] }
    if (view === 'semana') { const s = new Date(d); s.setDate(s.getDate() - s.getDay()); const e = new Date(s); e.setDate(e.getDate() + 7); return [s, e, `Semana de ${fmtD(s)} a ${fmtD(new Date(e.getTime() - 1))}`] }
    const s = new Date(d.getFullYear(), d.getMonth(), 1); const e = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    return [s, e, s.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })]
  }, [view, ref])

  function navega(dir: number) {
    const d = new Date(ref)
    if (view === 'dia') d.setDate(d.getDate() + dir)
    else if (view === 'semana') d.setDate(d.getDate() + dir * 7)
    else d.setMonth(d.getMonth() + dir)
    setRef(d)
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return lista
      .filter(m => { const d = effDate(m); return d && d >= from && d < to })
      .filter(m => !fStatus || m.status === fStatus)
      .filter(m => !fProf || (m.responsavel || '') === fProf)
      .filter(m => !q || [m.empresa, m.contato_nome, m.contact_identifier, m.assunto].some(v => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => (effDate(a)?.getTime() || 0) - (effDate(b)?.getTime() || 0))
  }, [lista, from, to, fStatus, fProf, busca])

  function temConflito(prof: string, startMs: number | null, dur: number, ignoreId?: string): AgMeeting | null {
    if (!prof || !startMs) return null
    const end = startMs + dur * 60000
    for (const m of lista) {
      if (m.id === ignoreId) continue
      if (['cancelada', 'recusada', 'ausente'].includes(m.status)) continue
      if ((m.responsavel || '').trim().toLowerCase() !== prof.trim().toLowerCase()) continue
      if (!m.start_at) continue
      const s = new Date(m.start_at).getTime(); const e = s + (m.duracao_min || 30) * 60000
      if (startMs < e && s < end) return m
    }
    return null
  }

  async function criar() {
    if (!schemaReady) { toast('Rode supabase/07_agenda.sql para ativar a agenda.', false); return }
    const start = form.data && form.hora ? new Date(`${form.data}T${form.hora}:00-03:00`) : null
    const dur = Number(form.duracao) || 30
    if (start) {
      const conf = temConflito(form.profissional, start.getTime(), dur)
      if (conf) { toast(`Conflito: ${seg.profissional} "${form.profissional}" já tem agendamento nesse horário.`, false); return }
    }
    const camposObj: Record<string, any> = {}
    for (const key of Object.keys(form.campos || {})) { const val = form.campos[key]; if (val !== '' && val != null) camposObj[key] = val }
    setBusy('novo')
    const row: any = {
      agent_id: agentId, empresa: form.empresa || null, contato_nome: form.contato_nome || null,
      contact_identifier: form.contact_identifier || null, assunto: form.assunto || null,
      responsavel: form.profissional || null, canal: form.canal || null, origem: 'Manual',
      tipo: form.tipo || null, duracao_min: dur, observacoes: form.observacoes || null,
      start_at: start ? start.toISOString() : null, status: form.status || 'confirmada',
      source: 'manual', campos: camposObj,
    }
    const { data, error } = await supabase.from('meetings').insert(row).select('*').single()
    setBusy('')
    if (error) { toast(error.message, false); return }
    setLista(p => [...p, data as AgMeeting])
    setShowForm(false); setForm(novo()); toast('Agendamento criado.')
  }

  async function setStatus(id: string, status: string, extra: any = {}) {
    setBusy(id + status)
    const patch = { status, ...extra }
    const { error } = await supabase.from('meetings').update(patch).eq('id', id)
    setBusy('')
    if (error) { toast(error.message, false); return }
    setLista(p => p.map(m => m.id === id ? { ...m, ...patch } : m))
  }

  // Registra a venda em Vendas Geradas/faturamento, deduplicado por campos._venda.
  async function registrarVenda(m: AgMeeting, produto: string, valor: string, okMsg: string) {
    const cp = m.campos || {}
    if (cp._venda) return                                  // já gerou venda — não duplica
    if (!valor) { toast(okMsg + ' (sem valor — não somou ao faturamento).'); return }
    setBusy(m.id + 'venda')
    try {
      const res = await fetch('/api/painel/venda', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cliente: m.empresa || m.contato_nome, contato: m.contato_nome, telefone: m.contact_identifier, produto, valor, forma_pagamento: cp.forma_pagamento, status: 'confirmed', observacoes: m.observacoes }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast('Registrado, mas a venda não foi contabilizada: ' + (data.error || ''), false); return }
      const novoCampos = { ...cp, _venda: true }
      await supabase.from('meetings').update({ campos: novoCampos }).eq('id', m.id)
      setLista(p => p.map(x => x.id === m.id ? { ...x, campos: novoCampos } : x))
      toast(okMsg + ' Venda registrada no faturamento.')
    } catch { toast('Registrado, mas falhou ao contabilizar a venda.', false) } finally { setBusy('') }
  }
  // Alimentício: confirmar pedido → venda
  async function confirmarPedido(m: AgMeeting) {
    const cp = m.campos || {}
    await setStatus(m.id, 'confirmada')
    await registrarVenda(m, cp.produtos || m.assunto || 'Pedido', cp.valor_total || cp.valor_produtos || '', 'Pedido confirmado.')
  }
  // Serviços: concluir atendimento → venda (valor do serviço)
  async function concluir(m: AgMeeting) {
    const cp = m.campos || {}
    await setStatus(m.id, 'realizada')
    await registrarVenda(m, m.assunto || seg.servico, cp.valor_servico || cp.valor_estimado || cp.valor_total || '', 'Atendimento concluído.')
  }
  async function reagendar(m: AgMeeting) {
    const d = prompt('Nova data (AAAA-MM-DD):', (m.start_at || m.requested_date || '').slice(0, 10)); if (!d) return
    const h = prompt('Novo horário (HH:MM):', m.start_at ? fmtT(m.start_at) : (m.requested_time || '09:00')); if (!h) return
    const start = new Date(`${d}T${h}:00-03:00`)
    const conf = temConflito(m.responsavel || '', start.getTime(), m.duracao_min || 30, m.id)
    if (conf) { toast('Conflito de horário para esse responsável.', false); return }
    setStatus(m.id, 'reagendada', { start_at: start.toISOString() })
  }

  const profOpts = useMemo(() => Array.from(new Set([...profissionais, ...lista.map(m => m.responsavel || '').filter(Boolean)])), [profissionais, lista])
  const nomeDe = (m: AgMeeting) => m.contato_nome || m.empresa || formatTel(m.contact_identifier) || '—'

  // Mobile: layout próprio (cards + navegação inferior) abaixo de 760px
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 760px)')
    const on = () => setIsMobile(mq.matches); on()
    mq.addEventListener('change', on); return () => mq.removeEventListener('change', on)
  }, [])
  // Atualização automática: recarrega os agendamentos a cada 25s (IA cria → aparece sozinho)
  useEffect(() => {
    let alive = true
    const t = setInterval(async () => {
      const { data, error } = await supabase.from('meetings').select('*').eq('agent_id', agentId).order('start_at', { ascending: true })
      if (alive && !error && data) setLista(data as AgMeeting[])
    }, 25000)
    return () => { alive = false; clearInterval(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId])

  // Detalhes e ações reutilizados (desktop + mobile)
  function Detalhes({ m }: { m: AgMeeting }) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 12 }}>
        {campos.map(c => m.campos?.[c.k] ? <div key={c.k}><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 2 }}>{c.label}</p><p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white }}>{m.campos[c.k]}</p></div> : null)}
        {m.campos?.valor_servico && <div><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 2 }}>Valor do serviço</p><p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: 'var(--c-green)', fontWeight: 500 }}>{m.campos.valor_servico}</p></div>}
        {m.campos?.unidade && <div><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 2 }}>Unidade</p><p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white }}>{m.campos.unidade}</p></div>}
        {m.empresa && m.contato_nome && <div><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 2 }}>Empresa</p><p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.white }}>{m.empresa}</p></div>}
        {m.observacoes && <div style={{ gridColumn: '1 / -1' }}><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 2 }}>Observações</p><p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.muted, fontWeight: 300, lineHeight: 1.5 }}>{m.observacoes}</p></div>}
      </div>
    )
  }
  function Acoes({ m }: { m: AgMeeting }) {
    const conv = m.conversation_id || convMap[m.contact_identifier || ''] || ''
    const tel = (m.contact_identifier || '').replace(/\D/g, '')
    return (
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        {conv && <a href={`/painel/conversas/${conv}`} style={linkSt}>Ver conversa</a>}
        {tel && <a href={`https://wa.me/${tel}`} target="_blank" rel="noreferrer" style={{ ...linkSt, color: 'var(--c-green)' }}>Mensagem</a>}
        {tel && <a href={`tel:+${tel}`} style={linkSt}>Ligar</a>}
        {seg.pedidos ? (
          <>
            {['aguardando', 'aguardando_info', 'sugerida', 'detectada'].includes(m.status) && <button onClick={() => confirmarPedido(m)} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>{busy === m.id + 'venda' ? 'Confirmando…' : 'Confirmar pedido'}</button>}
            {['confirmada'].includes(m.status) && <button onClick={() => setStatus(m.id, 'em_preparacao')} disabled={!!busy} style={{ ...linkSt, color: 'oklch(80% 0.16 215)' }}>Em preparação</button>}
            {['em_preparacao', 'confirmada'].includes(m.status) && <button onClick={() => setStatus(m.id, 'pronto')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Pronto</button>}
            {['pronto', 'em_preparacao'].includes(m.status) && <button onClick={() => setStatus(m.id, 'saiu_entrega')} disabled={!!busy} style={{ ...linkSt, color: 'oklch(80% 0.16 215)' }}>Saiu p/ entrega</button>}
            {['pronto', 'em_preparacao'].includes(m.status) && <button onClick={() => setStatus(m.id, 'aguardando_retirada')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-yellow)' }}>Aguardando retirada</button>}
            {['saiu_entrega', 'aguardando_retirada', 'pronto'].includes(m.status) && <button onClick={() => setStatus(m.id, 'entregue')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Entregue</button>}
            {['entregue', 'saiu_entrega', 'aguardando_retirada'].includes(m.status) && <button onClick={() => setStatus(m.id, 'realizada')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Concluir</button>}
          </>
        ) : (
          <>
            {['aguardando', 'aguardando_info', 'sugerida', 'detectada', 'aguardando_escolha', 'reagendada'].includes(m.status) && <button onClick={() => setStatus(m.id, 'confirmada')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Confirmar</button>}
            {['confirmada', 'reagendada'].includes(m.status) && <button onClick={() => setStatus(m.id, 'em_atendimento')} disabled={!!busy} style={{ ...linkSt, color: 'oklch(80% 0.16 215)' }}>Em atendimento</button>}
            {['confirmada', 'reagendada', 'em_atendimento'].includes(m.status) && <button onClick={() => concluir(m)} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>{busy === m.id + 'venda' ? 'Concluindo…' : 'Concluir'}</button>}
            {['confirmada', 'reagendada', 'em_atendimento'].includes(m.status) && <button onClick={() => setStatus(m.id, 'ausente')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Não compareceu</button>}
          </>
        )}
        {!['realizada', 'cancelada', 'recusada', 'entregue'].includes(m.status) && <button onClick={() => reagendar(m)} disabled={!!busy} style={{ ...linkSt, color: 'oklch(80% 0.16 215)' }}>Reagendar</button>}
        {!['cancelada', 'recusada', 'realizada'].includes(m.status) && <button onClick={() => { if (confirm('Cancelar este registro?')) setStatus(m.id, 'cancelada') }} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Cancelar</button>}
      </div>
    )
  }

  // ──────────────── MOBILE (cards + navegação inferior) ────────────────
  if (isMobile) {
    return (
      <AgendaMobile
        seg={seg} filtrados={filtrados} fStatus={fStatus} setFStatus={setFStatus} fProf={fProf} setFProf={setFProf}
        busca={busca} setBusca={setBusca} profOpts={profOpts} view={view} setView={setView} setRef={setRef}
        navega={navega} periodoLabel={periodoLabel} exp={exp} setExp={setExp} nomeDe={nomeDe}
        showForm={showForm} setShowForm={setShowForm} form={form} setForm={setForm} criar={criar} busy={busy}
        campos={campos} servicos={servicos} servicosLista={servicosLista} unidades={unidades}
        Detalhes={Detalhes} Acoes={Acoes} toasts={toasts}
      />
    )
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1320 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={T.h1}>Agenda</h1>
          <p style={{ ...T.sub, marginTop: 4 }}>Agendamentos do seu negócio ({seg.label}). Campos adaptados ao seu segmento.</p>
        </div>
        <button onClick={() => { setShowForm(s => !s); if (!showForm) setForm(novo()) }} className="btn-primary" style={{ fontSize: 13 }}>{showForm ? 'Fechar' : '+ Novo agendamento'}</button>
      </div>

      {!schemaReady && (
        <div style={{ background: 'color-mix(in oklch, var(--c-yellow) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--c-yellow) 26%, transparent)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <p style={{ fontFamily: FONT.dm, fontSize: 12.5, color: 'var(--c-yellow)', fontWeight: 300 }}>Rode <span style={{ fontFamily: FONT.jb }}>supabase/02_negocios.sql</span>, <span style={{ fontFamily: FONT.jb }}>03_agendamentos.sql</span> e <span style={{ fontFamily: FONT.jb }}>07_agenda.sql</span> para ativar a agenda.</p>
        </div>
      )}

      {showForm && <Form seg={seg} campos={campos} profissionais={profOpts} servicos={servicos} servicosLista={servicosLista} unidades={unidades} form={form} setForm={setForm} onSave={criar} busy={busy === 'novo'} onCancel={() => setShowForm(false)} />}

      {/* Toolbar */}
      <div style={{ ...CARD, padding: '12px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, background: C.void, borderRadius: 8, padding: 3 }}>
          {(['dia', 'semana', 'mes'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{ fontFamily: FONT.dm, fontSize: 12.5, padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: view === v ? 'var(--c-blue-b)' : 'transparent', color: view === v ? '#fff' : C.muted, textTransform: 'capitalize' }}>{v === 'mes' ? 'mês' : v}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => navega(-1)} className="btn-ghost" style={{ fontSize: 13, padding: '6px 10px' }}>‹</button>
          <button onClick={() => setRef(new Date())} className="btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}>Hoje</button>
          <button onClick={() => navega(1)} className="btn-ghost" style={{ fontSize: 13, padding: '6px 10px' }}>›</button>
          <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, marginLeft: 6, textTransform: 'capitalize' }}>{periodoLabel}</span>
        </div>
        <div style={{ flex: 1 }} />
        <input className="field" placeholder="Buscar nome ou telefone…" value={busca} onChange={e => setBusca(e.target.value)} style={{ width: 200, fontSize: 12.5 }} />
        <select className="field" value={fProf} onChange={e => setFProf(e.target.value)} style={{ width: 'auto', fontSize: 12.5 }}>
          <option value="">Todos {seg.profissional.toLowerCase()}s</option>
          {profOpts.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className="field" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 'auto', fontSize: 12.5 }}>
          <option value="">Todos status</option>
          {Object.entries(AGENDA_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div style={{ ...CARD, padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 920 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Data / Hora', seg.cliente, 'Contato', 'Tipo', seg.servico, seg.profissional, 'Duração', 'Canal', 'Status', 'Ações'].map(h => (
                <th key={h} style={{ ...T.mono, color: C.faint, fontSize: 9, textAlign: 'left', padding: '12px 14px', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr><td colSpan={10} style={{ padding: '48px 14px', textAlign: 'center', ...T.sub }}>Nenhum agendamento neste período. Use "+ Novo agendamento" ou aguarde a IA registrar.</td></tr>
            )}
            {filtrados.map(m => {
              const meta = AGENDA_STATUS[m.status] || { label: m.status, variant: 'muted' as const }
              const d = effDate(m)
              const aberto = exp === m.id
              return (
                <Fragment key={m.id}>
                  <tr style={{ borderBottom: `1px solid ${C.border}`, cursor: 'pointer' }} onClick={() => setExp(aberto ? '' : m.id)}>
                    <td style={td()}>{d ? `${fmtD(d)} ${m.start_at ? fmtT(m.start_at) : (m.requested_time || '')}` : '—'}</td>
                    <td style={td(C.white, 500)}>{nomeDe(m)}{m.source === 'ai_sugerida' && <span style={{ marginLeft: 6, ...T.mono, fontSize: 8, color: 'oklch(80% 0.16 215)' }}>IA</span>}</td>
                    <td style={td()}>{formatTel(m.contact_identifier)}</td>
                    <td style={td()}>{m.tipo || '—'}</td>
                    <td style={td()}>{m.assunto || '—'}</td>
                    <td style={td()}>{m.responsavel || '—'}</td>
                    <td style={td()}>{m.duracao_min ? `${m.duracao_min} min` : '—'}</td>
                    <td style={td()}>{m.canal || m.origem || '—'}</td>
                    <td style={{ ...td(), whiteSpace: 'nowrap' }}><span style={badgeStyle(meta.variant)}>{meta.label}</span></td>
                    <td style={{ ...td(), whiteSpace: 'nowrap' }}><span style={{ color: C.faint, fontSize: 11 }}>{aberto ? '▾' : '▸'}</span></td>
                  </tr>
                  {aberto && (
                    <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.void }}>
                      <td colSpan={10} style={{ padding: '14px 16px' }}>
                        <Detalhes m={m} />
                        <Acoes m={m} />
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
    </div>
  )
}

function td(color = 'var(--c-muted)', weight = 400): React.CSSProperties {
  return { padding: '11px 14px', fontFamily: 'var(--font-dm)', fontSize: 13, color, fontWeight: weight as any, verticalAlign: 'top' }
}

const PEND_STATUS = ['aguardando', 'aguardando_info', 'sugerida', 'detectada', 'aguardando_escolha']
function valorDe(m: AgMeeting): string {
  const c = m.campos || {}
  return c.valor_total || c.valor_servico || c.valor_estimado || c.valor_produtos || ''
}

// ──────────────── Layout mobile (app-like) ────────────────
function AgendaMobile(p: any) {
  const { seg, filtrados, fStatus, setFStatus, fProf, setFProf, busca, setBusca, profOpts,
    view, setView, setRef, navega, periodoLabel, exp, setExp, nomeDe,
    showForm, setShowForm, form, setForm, criar, busy, campos, servicos, servicosLista, unidades,
    Detalhes, Acoes, toasts } = p
  const [sheet, setSheet] = useState<'' | 'filtros'>('')
  const [pend, setPend] = useState(false)
  const lista = pend ? filtrados.filter((m: AgMeeting) => PEND_STATUS.includes(m.status)) : filtrados
  const chips = ['', 'confirmada', 'aguardando', seg.pedidos ? 'em_preparacao' : 'em_atendimento', seg.pedidos ? 'entregue' : 'realizada']

  return (
    <div className="animate-slide-up" style={{ paddingBottom: 78 }}>
      {/* Cabeçalho compacto */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <h1 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 20, color: C.white }}>Agenda</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={() => navega(-1)} className="btn-ghost" style={{ fontSize: 14, padding: '6px 10px' }}>‹</button>
          <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, minWidth: 90, textAlign: 'center', textTransform: 'capitalize' }}>{periodoLabel}</span>
          <button onClick={() => navega(1)} className="btn-ghost" style={{ fontSize: 14, padding: '6px 10px' }}>›</button>
        </div>
      </div>

      {/* Chips de status (rolável) */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 8 }}>
        {chips.map((s: string) => {
          const lbl = s === '' ? 'Todos' : (AGENDA_STATUS[s]?.label || s)
          const sel = fStatus === s
          return <button key={s || 'all'} onClick={() => { setFStatus(s); setPend(false) }} style={{ whiteSpace: 'nowrap', fontFamily: FONT.dm, fontSize: 12.5, padding: '7px 14px', borderRadius: 100, border: `1px solid ${sel ? 'var(--c-blue-b)' : C.border}`, background: sel ? 'oklch(55% 0.24 225/0.15)' : C.void, color: sel ? C.white : C.muted, flexShrink: 0 }}>{lbl}</button>
        })}
      </div>

      {/* Lista de cards */}
      {lista.length === 0 ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '40px 20px', ...T.sub }}>Nada por aqui. Toque em + para criar.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lista.map((m: AgMeeting) => {
            const meta = AGENDA_STATUS[m.status] || { label: m.status, variant: 'muted' as const }
            const d = effDate(m); const aberto = exp === m.id; const val = valorDe(m)
            return (
              <div key={m.id} style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
                <button onClick={() => setExp(aberto ? '' : m.id)} style={{ width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 15, color: C.white }}>{d ? (m.start_at ? fmtT(m.start_at) : (m.requested_time || fmtD(d))) : '—'}</span>
                    <span style={badgeStyle(meta.variant)}>{meta.label}</span>
                  </div>
                  <span style={{ fontFamily: FONT.dm, fontSize: 14.5, color: C.white, fontWeight: 500 }}>{nomeDe(m)}{m.source === 'ai_sugerida' && <span style={{ marginLeft: 6, ...T.mono, fontSize: 8, color: 'oklch(80% 0.16 215)' }}>IA</span>}</span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, ...T.sub, fontSize: 12.5 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[seg.pedidos ? m.tipo : m.assunto, m.responsavel].filter(Boolean).join(' · ') || '—'}</span>
                    {val && <span style={{ color: 'var(--c-green)', fontWeight: 500, flexShrink: 0 }}>{val}</span>}
                  </div>
                </button>
                {aberto && <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${C.border}`, paddingTop: 12 }}><Detalhes m={m} /><Acoes m={m} /></div>}
              </div>
            )
          })}
        </div>
      )}

      {/* FAB criar */}
      <button onClick={() => setShowForm(true)} aria-label="Criar" style={{ position: 'fixed', right: 18, bottom: 86, zIndex: 60, width: 56, height: 56, borderRadius: '50%', border: 'none', background: 'var(--c-blue-b)', color: '#fff', fontSize: 28, lineHeight: 1, boxShadow: '0 8px 24px oklch(55% 0.24 225/0.45)', cursor: 'pointer' }}>+</button>

      {/* Navegação inferior */}
      <nav style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 55, background: C.deep, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-around', padding: '8px 4px 10px' }}>
        {[
          { k: 'hoje', l: 'Hoje', on: () => { setView('dia'); setRef(new Date()); setPend(false) } },
          { k: 'cal', l: 'Calendário', on: () => { setView('mes'); setPend(false) } },
          { k: 'criar', l: 'Criar', on: () => setShowForm(true) },
          { k: 'pend', l: 'Pendentes', on: () => { setPend(true); setView('mes') } },
          { k: 'filtros', l: 'Filtros', on: () => setSheet('filtros') },
        ].map(it => (
          <button key={it.k} onClick={it.on} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: (it.k === 'pend' && pend) ? 'var(--c-blue-b)' : C.muted, fontFamily: FONT.dm, fontSize: 10.5, flex: 1 }}>
            <span style={{ fontSize: 16 }}>{it.k === 'hoje' ? '📅' : it.k === 'cal' ? '🗓️' : it.k === 'criar' ? '➕' : it.k === 'pend' ? '⏳' : '⚙️'}</span>
            {it.l}
          </button>
        ))}
      </nav>

      {/* Sheet de filtros */}
      {sheet === 'filtros' && (
        <div onClick={() => setSheet('')} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'oklch(10% 0.03 250/0.6)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', background: C.deep, borderRadius: '16px 16px 0 0', border: `1px solid ${C.borderHi}`, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 16, color: C.white }}>Filtros</h2>
            <div><label style={T.label}>Buscar</label><input className="field" placeholder="Nome ou telefone" value={busca} onChange={e => setBusca(e.target.value)} /></div>
            <div><label style={T.label}>{seg.profissional}</label><select className="field" value={fProf} onChange={e => setFProf(e.target.value)}><option value="">Todos</option>{profOpts.map((x: string) => <option key={x} value={x}>{x}</option>)}</select></div>
            <div><label style={T.label}>Status</label><select className="field" value={fStatus} onChange={e => setFStatus(e.target.value)}><option value="">Todos</option>{Object.entries(AGENDA_STATUS).map(([k, v]: any) => <option key={k} value={k}>{v.label}</option>)}</select></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setBusca(''); setFProf(''); setFStatus(''); setPend(false) }} className="btn-ghost" style={{ fontSize: 13, flex: 1 }}>Limpar</button>
              <button onClick={() => setSheet('')} className="btn-primary" style={{ fontSize: 13, flex: 1 }}>Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {/* Sheet criar */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: C.void, overflowY: 'auto' }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white }}>Novo registro</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <Form seg={seg} campos={campos} profissionais={profOpts} servicos={servicos} servicosLista={servicosLista} unidades={unidades} form={form} setForm={setForm} onSave={() => { criar() }} busy={busy === 'novo'} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div style={{ position: 'fixed', left: 12, right: 12, bottom: 88, zIndex: 90, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {toasts.map((t: any) => (
            <div key={t.id} style={{ background: C.deep, border: `1px solid ${t.ok ? 'rgba(34,197,94,0.4)' : 'rgba(232,64,64,0.4)'}`, borderLeft: `3px solid ${t.ok ? 'var(--c-green)' : 'var(--c-red)'}`, borderRadius: 10, padding: '12px 14px', display: 'flex', gap: 10 }}>
              <span style={{ color: t.ok ? 'var(--c-green)' : 'var(--c-red)' }}>{t.ok ? '✓' : '⚠'}</span>
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>{t.t}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
function formatTel(id?: string | null): string {
  if (!id) return ''
  const n = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(n)) return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 9)}-${n.slice(9)}`
  return n
}
function novo() {
  return { empresa: '', contato_nome: '', contact_identifier: '', assunto: '', data: '', hora: '', duracao: '30', profissional: '', tipo: 'reuniao', canal: '', observacoes: '', status: 'confirmada', campos: {} as Record<string, any> }
}

function Form({ seg, campos, profissionais, servicos, servicosLista = [], unidades = [], form, setForm, onSave, busy, onCancel }: { seg: Segmento; campos: CampoExtra[]; profissionais: string[]; servicos: string[]; servicosLista?: ServicoItem[]; unidades?: string[]; form: any; setForm: (f: any) => void; onSave: () => void; busy: boolean; onCancel: () => void }) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v })
  const setCampo = (k: string, v: any) => setForm({ ...form, campos: { ...(form.campos || {}), [k]: v } })
  function pickServico(nome: string) {
    const s = servicosLista.find(x => x.nome === nome)
    setForm({ ...form, assunto: nome, ...(s?.duracao ? { duracao: String(s.duracao) } : {}), campos: { ...(form.campos || {}), valor_servico: s?.valor || form.campos?.valor_servico || '' } })
  }
  const Row = ({ children }: { children: React.ReactNode }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>{children}</div>
  const F = ({ label, children }: { label: string; children: React.ReactNode }) => <div><label style={T.label}>{label}</label>{children}</div>
  return (
    <div style={{ ...CARD, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Row>
        <F label={seg.cliente}><input className="field" value={form.contato_nome} onChange={e => set('contato_nome', e.target.value)} /></F>
        <F label="Telefone / contato"><input className="field" value={form.contact_identifier} onChange={e => set('contact_identifier', e.target.value)} placeholder="5511999999999" /></F>
        {seg.pedidos
          ? <F label="Modalidade do pedido"><select className="field" value={form.tipo} onChange={e => set('tipo', e.target.value)}><option value="">—</option>{MODALIDADES_PEDIDO.map(m => <option key={m} value={m}>{m}</option>)}</select></F>
          : <F label="Empresa (opcional)"><input className="field" value={form.empresa} onChange={e => set('empresa', e.target.value)} /></F>}
      </Row>
      <Row>
        <F label="Data"><input className="field" type="date" value={form.data} onChange={e => set('data', e.target.value)} /></F>
        <F label="Horário"><input className="field" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} /></F>
        <F label="Duração (min)"><input className="field" type="number" value={form.duracao} onChange={e => set('duracao', e.target.value)} /></F>
      </Row>
      <Row>
        <F label={seg.servico}>
          {servicosLista.length
            ? <select className="field" value={form.assunto} onChange={e => pickServico(e.target.value)}><option value="">—</option>{servicosLista.map(s => <option key={s.nome} value={s.nome}>{s.nome}{s.valor ? ` — ${s.valor}` : ''}{s.duracao ? ` (${s.duracao}min)` : ''}</option>)}</select>
            : servicos.length
              ? <select className="field" value={form.assunto} onChange={e => set('assunto', e.target.value)}><option value="">—</option>{servicos.map(s => <option key={s} value={s}>{s}</option>)}</select>
              : <input className="field" value={form.assunto} onChange={e => set('assunto', e.target.value)} />}
        </F>
        <F label={seg.profissional}>
          {profissionais.length
            ? <select className="field" value={form.profissional} onChange={e => set('profissional', e.target.value)}><option value="">—</option>{profissionais.map(p => <option key={p} value={p}>{p}</option>)}</select>
            : <input className="field" value={form.profissional} onChange={e => set('profissional', e.target.value)} />}
        </F>
        <F label="Canal"><input className="field" value={form.canal} onChange={e => set('canal', e.target.value)} placeholder="WhatsApp, presencial…" /></F>
        {unidades.length > 0 && <F label="Unidade"><select className="field" value={form.campos?.unidade || ''} onChange={e => setCampo('unidade', e.target.value)}><option value="">—</option>{unidades.map(u => <option key={u} value={u}>{u}</option>)}</select></F>}
      </Row>
      {campos.length > 0 && (
        <Row>
          {campos.map(c => <F key={c.k} label={c.label}><input className="field" value={form.campos?.[c.k] || ''} onChange={e => setCampo(c.k, e.target.value)} /></F>)}
        </Row>
      )}
      <F label="Observações"><textarea className="field" rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} /></F>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave} disabled={busy} className="btn-primary" style={{ fontSize: 12 }}>{busy ? 'Salvando…' : 'Salvar agendamento'}</button>
        <button onClick={onCancel} className="btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
      </div>
    </div>
  )
}
