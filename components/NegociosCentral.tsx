'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { C, T, CARD, FONT } from '@/lib/styles'

// ──────────────────────────────────────────────── tipos
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
export interface Meeting {
  id: string
  agent_id: string
  deal_id: string | null
  conversation_id: string | null
  contact_identifier: string | null
  empresa: string | null
  contato_nome: string | null
  assunto: string | null
  observacoes: string | null
  proximo_passo: string | null
  responsavel: string | null
  canal: string | null
  origem: string | null
  start_at: string | null
  end_at: string | null
  duracao_min: number | null
  timezone: string | null
  status: string
  source: string | null
  provider: string | null
  meeting_url: string | null
  created_at: string | null
  tipo: string | null
  modalidade: string | null
  endereco: string | null
  periodo: string | null
  requested_date: string | null
  requested_time: string | null
  alternative_slots: { date?: string; time?: string }[] | null
}
export interface Sched {
  mode?: string; address?: string; responsibles?: string
  modalidade_presencial?: boolean; modalidade_online?: boolean; modalidade_telefone?: boolean
}
export interface Proposal {
  id: string
  agent_id: string
  deal_id: string | null
  contact_identifier: string | null
  empresa: string | null
  contato_nome: string | null
  produto: string | null
  valor: string | null
  conteudo: string | null
  validade: string | null
  responsavel: string | null
  status: string
  created_at: string | null
  sent_at: string | null
}
interface Funnel { conversas: number; leads: number; oportunidades: number; reunioes: number; propostas: number; vendas: number }

// ──────────────────────────────────────────────── meta de status
const CYAN = 'oklch(80% 0.16 215)'
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

const mMeta: Record<string, { label: string; cor: string }> = {
  detectada:          { label: 'Detectada pela IA',         cor: CYAN },
  aguardando_info:    { label: 'Aguardando informações',    cor: 'var(--c-yellow)' },
  aguardando:         { label: 'Aguardando confirmação',    cor: 'var(--c-yellow)' },
  sugerida:           { label: 'Sugerida pela IA',          cor: CYAN },
  aguardando_escolha: { label: 'Aguardando escolha do cliente', cor: CYAN },
  confirmada:         { label: 'Reunião confirmada',        cor: 'var(--c-green)' },
  reagendada:         { label: 'Reagendada',                cor: CYAN },
  realizada:          { label: 'Realizada',                 cor: 'var(--c-green)' },
  cancelada:          { label: 'Cancelada',                 cor: 'var(--c-muted)' },
  ausente:            { label: 'Cliente não compareceu',    cor: 'var(--c-red)' },
  recusada:           { label: 'Recusada',                  cor: 'var(--c-muted)' },
}
const modLabel: Record<string, string> = { presencial: 'Presencial', online: 'Online', telefone: 'Telefone' }
const pMeta: Record<string, { label: string; cor: string }> = {
  rascunho:         { label: 'Rascunho',          cor: 'var(--c-muted)' },
  aguardando_envio: { label: 'Aguardando envio',  cor: 'var(--c-yellow)' },
  enviada:          { label: 'Enviada',           cor: 'var(--c-blue-b)' },
  visualizada:      { label: 'Visualizada',       cor: CYAN },
  em_negociacao:    { label: 'Em negociação',     cor: 'var(--c-yellow)' },
  aceita:           { label: 'Aceita',            cor: 'var(--c-green)' },
  recusada:         { label: 'Recusada',          cor: 'var(--c-red)' },
  expirada:         { label: 'Expirada',          cor: 'var(--c-muted)' },
}
const PROB: Record<string, number> = { confirmed: 100, negociacao: 70, proposta: 55, pending: 30 }

// ──────────────────────────────────────────────── helpers
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
const fmtTime = (d?: string | null) => d ? new Date(d).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }) : '—'
const brl = (n: number) => 'R$ ' + n.toLocaleString('pt-BR')
const daysSince = (d?: string | null) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null
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

const linkSt: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-muted)', padding: 0 }
const fieldHalf: React.CSSProperties = { minWidth: 0 }

// badge reutilizável
function Badge({ cor, children }: { cor: string; children: React.ReactNode }) {
  return <span style={{ fontFamily: FONT.jb, fontSize: 9, color: cor, padding: '3px 9px', borderRadius: 100, background: `color-mix(in oklch, ${cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 28%, transparent)` }}>{children}</span>
}

// ──────────────────────────────────────────────── componente
export function NegociosCentral({ deals, funnel, convMap, meetings, proposals, agentId, schemaReady, sched }: {
  deals: Deal[]; funnel: Funnel; convMap: Record<string, string>
  meetings: Meeting[]; proposals: Proposal[]; agentId: string; schemaReady: boolean; sched?: Sched
}) {
  const supabase = createClient()
  const [lista, setLista] = useState<Deal[]>(deals)
  const [listaM, setListaM] = useState<Meeting[]>(meetings)
  const [listaP, setListaP] = useState<Proposal[]>(proposals)
  const [busy, setBusy] = useState('')
  const [editId, setEditId] = useState('')
  const [edit, setEdit] = useState<any>({})
  const [propostas, setPropostas] = useState<Record<string, string>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({ agenda: true, propostas: true, negociacoes: true, vendas: true, validacao: true, perdidos: false })
  const [showMForm, setShowMForm] = useState(false)
  const [showPForm, setShowPForm] = useState(false)
  const [mForm, setMForm] = useState<any>(novaReuniao())
  const [pForm, setPForm] = useState<any>(novaProposta())
  const [offerId, setOfferId] = useState('')
  const [offerSlots, setOfferSlots] = useState<{ date: string; time: string }[]>([{ date: '', time: '' }, { date: '', time: '' }, { date: '', time: '' }])
  const [toasts, setToasts] = useState<{ id: number; type: 'ok' | 'err' | 'info'; text: string }[]>([])
  const [sendFail, setSendFail] = useState<Record<string, { messageId?: string; error: string }>>({})
  const [limpar, setLimpar] = useState<0 | 1 | 2>(0)   // 0 fechado · 1 período · 2 confirmar
  const [limparPeriod, setLimparPeriod] = useState('')
  const [limparBusy, setLimparBusy] = useState(false)
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }))
  function toast(text: string, type: 'ok' | 'err' | 'info' = 'info') {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, type, text }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000)
  }
  async function apagarReunioes() {
    setLimparBusy(true)
    try {
      const res = await fetch('/api/painel/limpar-reunioes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ period: limparPeriod }) })
      const data = await res.json().catch(() => ({}))
      setLimparBusy(false)
      if (!res.ok) { toast(data.error || 'Não foi possível apagar o histórico de reuniões.', 'err'); return }
      const ids: string[] = data.ids || []
      setListaM(prev => prev.filter(m => !ids.includes(m.id)))   // atualiza a listagem
      setLimpar(0); setLimparPeriod('')
      toast('Histórico de reuniões apagado com sucesso.', 'ok')
    } catch { setLimparBusy(false); toast('Não foi possível apagar o histórico de reuniões. Tente novamente.', 'err') }
  }

  // ── derivados de deals
  const confirmados = lista.filter(d => d.status === 'confirmed')
  const pendentes   = lista.filter(d => d.status === 'pending')
  const emValidacao = lista.filter(d => d.status === 'pending' || d.status === 'proposta' || d.status === 'negociacao')
  const negociacoes = lista.filter(d => d.status === 'proposta' || d.status === 'negociacao')
  const perdidos    = lista.filter(d => d.status === 'rejected')

  let totMin = 0, totMax = 0, comValor = 0
  for (const d of confirmados) { const r = parseRange(d.valor); if (r) { totMin += r[0]; totMax += r[1]; comValor++ } }
  const receita = comValor ? rangeLabel(totMin, totMax) : '—'
  const ticket  = comValor ? rangeLabel(Math.round(totMin / comValor), Math.round(totMax / comValor)) : '—'

  // ── derivados de reuniões
  const agora = Date.now()
  const SOLIC = ['detectada', 'aguardando', 'aguardando_info', 'sugerida']
  const HIST = ['realizada', 'cancelada', 'ausente', 'recusada']
  const solicitacoesReun = listaM.filter(m => SOLIC.includes(m.status))
  const aguardandoEscolha = listaM.filter(m => m.status === 'aguardando_escolha')
  const confirmadasReun = listaM.filter(m => m.status === 'confirmada')
  const reagendadasReun = listaM.filter(m => m.status === 'reagendada')
  const historicoReun = listaM.filter(m => HIST.includes(m.status))
  const realizadasReun = listaM.filter(m => m.status === 'realizada')
  const hojeStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const reunHoje = [...confirmadasReun, ...reagendadasReun].filter(m => m.start_at && new Date(m.start_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) === hojeStr)
  const proxReuniao = [...confirmadasReun, ...reagendadasReun].filter(m => m.start_at && new Date(m.start_at).getTime() >= agora - 3600000).sort((a, b) => (a.start_at || '').localeCompare(b.start_at || ''))[0]
  const reunMarcadas = confirmadasReun.length + reagendadasReun.length
  const reunAguard = solicitacoesReun.length
  const compareceu = realizadasReun.length
  const ausencias = listaM.filter(m => m.status === 'ausente').length
  const taxaComparec = (compareceu + ausencias) ? Math.round((compareceu / (compareceu + ausencias)) * 100) : null
  // taxa de fechamento após reunião
  const contatosComReuniaoRealizada = new Set(realizadasReun.map(m => m.contact_identifier).filter(Boolean))
  const fechouAposReun = confirmados.filter(d => contatosComReuniaoRealizada.has(d.contact_identifier)).length
  const taxaFechReun = contatosComReuniaoRealizada.size ? Math.round((fechouAposReun / contatosComReuniaoRealizada.size) * 100) : null

  // ── derivados de propostas
  const propEnviadas = listaP.filter(p => ['enviada', 'visualizada', 'em_negociacao'].includes(p.status))
  const propAceitas  = listaP.filter(p => p.status === 'aceita')

  // ── follow-ups pendentes
  const contatosComProposta = new Set(listaP.map(p => p.contact_identifier).filter(Boolean))
  const followups: { cliente: string; motivo: string; prazo: string; prioridade: 'alta' | 'media'; conv: string }[] = []
  for (const p of propEnviadas) {
    const dias = daysSince(p.sent_at || p.created_at)
    if (dias !== null && dias >= 3) followups.push({ cliente: p.empresa || p.contato_nome || 'Cliente', motivo: `Proposta enviada há ${dias} dias sem resposta`, prazo: 'Retornar hoje', prioridade: 'alta', conv: convMap[p.contact_identifier ?? ''] || '' })
  }
  for (const m of realizadasReun) {
    if (!contatosComProposta.has(m.contact_identifier)) followups.push({ cliente: m.empresa || m.contato_nome || 'Cliente', motivo: 'Reunião realizada sem proposta enviada', prazo: 'Gerar proposta', prioridade: 'alta', conv: convMap[m.contact_identifier ?? ''] || (m.conversation_id ?? '') })
  }
  for (const d of negociacoes) {
    const dias = daysSince(d.confirmed_at || d.detected_at)
    if (dias !== null && dias >= 7) followups.push({ cliente: d.empresa || d.contato_nome || 'Cliente', motivo: `Negociação parada há ${dias} dias`, prazo: 'Reativar contato', prioridade: 'media', conv: convMap[d.contact_identifier ?? ''] || '' })
  }

  // ── cards de métricas
  const cards = [
    { label: 'Vendas fechadas', value: String(confirmados.length), cor: 'var(--c-green)', desc: 'Clientes confirmados pela equipe.' },
    { label: 'Valor estimado', value: receita, cor: 'var(--c-green)', desc: 'Receita mensal potencial detectada.', small: true },
    { label: 'Aguardando confirmação', value: String(pendentes.length), cor: 'var(--c-yellow)', desc: 'Oportunidades que precisam ser validadas.' },
    { label: 'Ticket médio', value: ticket, cor: 'var(--c-blue-b)', desc: 'Média estimada por cliente fechado.', small: true },
    { label: 'Reuniões marcadas', value: String(reunMarcadas + reunAguard), cor: CYAN, desc: 'Confirmadas e aguardando confirmação.' },
    { label: 'Propostas enviadas', value: String(propEnviadas.length), cor: 'var(--c-blue-b)', desc: 'Propostas no aguardo de resposta.' },
  ]

  // ── insights
  const insights: string[] = []
  if (reunMarcadas) insights.push('Leads que marcam reunião têm maior chance de fechamento — priorize-os.')
  followups.filter(f => f.motivo.startsWith('Proposta')).slice(0, 1).forEach(f => insights.push(`${f.motivo} (${f.cliente}). Vale um follow-up.`))
  if (realizadasReun.some(m => !contatosComProposta.has(m.contact_identifier))) insights.push('Uma reunião foi realizada, mas nenhuma proposta foi registrada para o contato.')
  if (negociacoes.some(d => { const dd = daysSince(d.confirmed_at || d.detected_at); return dd !== null && dd >= 7 })) insights.push('Há negociações com mais de 7 dias sem interação — risco de esfriar.')
  if (lista.some(d => d.volume)) insights.push('Clientes que informam volume mensal devem ser priorizados.')
  if (!insights.length) insights.push('Conforme reuniões e propostas forem registradas, os insights comerciais aparecem aqui.')

  // ── próximas ações
  const acoes: { titulo: string; desc: string; onClick?: () => void; href?: string }[] = []
  if (reunAguard) acoes.push({ titulo: 'Confirmar reunião pendente', desc: `${reunAguard} reunião(ões) aguardando confirmação.`, onClick: () => { setOpen(p => ({ ...p, agenda: true })); } })
  realizadasReun.filter(m => !contatosComProposta.has(m.contact_identifier)).slice(0, 1).forEach(m => acoes.push({ titulo: 'Gerar proposta', desc: 'A reunião foi realizada, mas ainda não existe proposta registrada.', onClick: () => prefillProposta(m) }))
  if (followups.some(f => f.motivo.startsWith('Proposta'))) acoes.push({ titulo: 'Fazer follow-up de proposta', desc: 'Existe proposta aguardando resposta há mais de 3 dias.', onClick: () => setOpen(p => ({ ...p, propostas: true })) })
  if (negociacoes.length) acoes.push({ titulo: 'Revisar negociação parada', desc: 'Acompanhe as negociações em andamento e avance o próximo passo.', onClick: () => setOpen(p => ({ ...p, negociacoes: true })) })
  if (pendentes.length) acoes.push({ titulo: 'Confirmar venda', desc: `${pendentes.length} oportunidade(s) aguardando confirmação de fechamento.`, onClick: () => setOpen(p => ({ ...p, validacao: true })) })
  acoes.push({ titulo: 'Ver agenda comercial', desc: 'Acompanhe reuniões marcadas, realizadas e canceladas.', onClick: () => setOpen(p => ({ ...p, agenda: true })) })

  // ──────────────── ações de dados (deals)
  async function setStatus(id: string, status: string) {
    setBusy(id + status)
    const patch: any = { status, confirmed_at: status === 'confirmed' ? new Date().toISOString() : null }
    const { error } = await supabase.from('deals').update(patch).eq('id', id)
    setBusy('')
    if (error) { toast(error.message, 'err'); return }
    setLista(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d))
  }
  function abrirEdit(d: Deal) { setEditId(d.id); setEdit({ empresa: d.empresa || '', produto: d.produto || '', volume: d.volume || '', valor: d.valor || '', status: d.status, resumo: d.resumo || '' }) }
  async function salvarEdit(id: string) {
    setBusy(id + 'save')
    const patch: any = { ...edit, confirmed_at: edit.status === 'confirmed' ? new Date().toISOString() : null }
    const { error } = await supabase.from('deals').update(patch).eq('id', id)
    setBusy('')
    if (error) { toast(error.message, 'err'); return }
    setLista(prev => prev.map(d => d.id === id ? { ...d, ...patch } : d)); setEditId('')
  }
  async function gerarProposta(id: string) {
    setBusy(id + 'prop')
    const res = await fetch('/api/painel/gerar-proposta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deal_id: id }) })
    const data = await res.json(); setBusy('')
    if (!res.ok) { toast(data.error || 'Erro ao gerar proposta.', 'err'); return }
    setPropostas(prev => ({ ...prev, [id]: data.proposta }))
  }

  // ──────────────── ações de dados (reuniões)
  async function criarReuniao() {
    if (!schemaReady) { toast('Rode o SQL supabase/02_negocios.sql para ativar reuniões.', 'err'); return }
    setBusy('mnew')
    const start_at = mForm.data && mForm.hora ? new Date(`${mForm.data}T${mForm.hora}:00-03:00`).toISOString() : null
    const row: any = {
      agent_id: agentId, empresa: mForm.empresa || null, contato_nome: mForm.contato || null,
      contact_identifier: mForm.contact_identifier || null, assunto: mForm.assunto || null,
      responsavel: mForm.responsavel || null, canal: mForm.canal || null, origem: mForm.origem || 'WhatsApp',
      start_at, duracao_min: Number(mForm.duracao) || 30, status: mForm.status || 'aguardando',
      tipo: mForm.tipo || null, modalidade: mForm.modalidade || null,
      endereco: mForm.modalidade === 'presencial' ? (mForm.endereco || sched?.address || null) : null,
      meeting_url: mForm.meeting_url || null, provider: mForm.provider || null,
      observacoes: mForm.observacoes || null, proximo_passo: mForm.proximo_passo || null,
      deal_id: mForm.deal_id || null,
    }
    const { data, error } = await supabase.from('meetings').insert(row).select('*').single()
    setBusy('')
    if (error) { toast(error.message, 'err'); return }
    setListaM(prev => [...prev, data as Meeting].sort((a, b) => (a.start_at || '').localeCompare(b.start_at || '')))
    setShowMForm(false); setMForm(novaReuniao())
  }
  async function meetingAcao(id: string, acao: string, payload: any = {}) {
    setBusy(id + acao)
    let res: Response, data: any
    try {
      res = await fetch('/api/painel/reuniao/acao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meeting_id: id, acao, ...payload }) })
      data = await res.json().catch(() => ({}))
    } catch { setBusy(''); toast('Falha de conexão ao processar a ação.', 'err'); return }
    setBusy('')
    if (!res.ok) { toast(data.error || 'Erro ao processar a ação.', 'err'); return }
    setListaM(prev => prev.map(m => m.id === id ? {
      ...m, status: data.status ?? m.status,
      ...(payload.start_at ? { start_at: payload.start_at } : {}),
      ...(acao === 'oferecer_datas' ? { alternative_slots: payload.slots } : {}),
    } : m))
    setOfferId('')
    if (data.sent) {
      if (data.sendOk) {
        setSendFail(prev => { const n = { ...prev }; delete n[id]; return n })
        toast('Reunião atualizada e mensagem enviada ao cliente.', 'ok')
      } else {
        // mantém a reunião atualizada; mostra aviso + opção de reenviar (quando aplicável)
        setSendFail(prev => ({ ...prev, [id]: { messageId: data.retryable ? data.messageId : undefined, error: data.sendError || 'Falha ao enviar a mensagem.' } }))
        toast(data.sendError || 'Reunião atualizada, mas a mensagem ao cliente falhou.', 'err')
      }
    } else {
      toast('Reunião atualizada.', 'ok')
    }
  }
  async function reenviar(meetingId: string, messageId?: string) {
    if (!messageId) { toast('Não há mensagem para reenviar — verifique o telefone do cliente.', 'err'); return }
    setBusy(meetingId + 'reenviar')
    let ok = false, err = ''
    try {
      const r = await fetch('/api/messages/resend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message_id: messageId }) })
      const d = await r.json().catch(() => ({})); ok = r.ok; err = d.error || ''
    } catch { err = 'Falha de conexão.' }
    setBusy('')
    if (ok) { setSendFail(prev => { const n = { ...prev }; delete n[meetingId]; return n }); toast('Mensagem reenviada ao cliente.', 'ok') }
    else toast(err || 'Não foi possível reenviar.', 'err')
  }
  async function reagendar(m: Meeting) {
    const data = prompt('Nova data (AAAA-MM-DD):', (m.start_at || m.requested_date || '').slice(0, 10)); if (!data) return
    const hora = prompt('Novo horário (HH:MM):', m.start_at ? fmtTime(m.start_at) : (m.requested_time || '09:00')); if (!hora) return
    meetingAcao(m.id, 'reagendar', { start_at: new Date(`${data}T${hora}:00-03:00`).toISOString() })
  }
  function enviarOferta(id: string) {
    const slots = offerSlots.filter(s => s.date)
    if (!slots.length) { toast('Informe ao menos uma data alternativa.', 'err'); return }
    meetingAcao(id, 'oferecer_datas', { slots })
  }

  // ──────────────── ações de dados (propostas)
  function prefillProposta(src: Meeting | Deal) {
    const m = src as any
    setPForm({ ...novaProposta(), empresa: m.empresa || '', contato: m.contato_nome || '', contact_identifier: m.contact_identifier || '', produto: m.produto || '', valor: m.valor || '', deal_id: (m as any).deal_id || (m as Deal).id || null })
    setShowPForm(true); setOpen(p => ({ ...p, propostas: true }))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function criarProposta() {
    if (!schemaReady) { toast('Rode o SQL supabase/02_negocios.sql para ativar propostas.', 'err'); return }
    setBusy('pnew')
    const row: any = {
      agent_id: agentId, empresa: pForm.empresa || null, contato_nome: pForm.contato || null,
      contact_identifier: pForm.contact_identifier || null, produto: pForm.produto || null,
      valor: pForm.valor || null, validade: pForm.validade || null, responsavel: pForm.responsavel || null,
      conteudo: pForm.conteudo || null, status: pForm.status || 'rascunho', deal_id: pForm.deal_id || null,
    }
    const { data, error } = await supabase.from('proposals').insert(row).select('*').single()
    setBusy('')
    if (error) { toast(error.message, 'err'); return }
    setListaP(prev => [data as Proposal, ...prev])
    setShowPForm(false); setPForm(novaProposta())
  }
  async function setProposalStatus(id: string, status: string) {
    setBusy(id + status)
    const patch: any = { status, updated_at: new Date().toISOString() }
    if (status === 'enviada') patch.sent_at = new Date().toISOString()
    const { error } = await supabase.from('proposals').update(patch).eq('id', id)
    setBusy('')
    if (error) { toast(error.message, 'err'); return }
    setListaP(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }
  async function duplicarProposta(p: Proposal) {
    if (!schemaReady) return
    setBusy(p.id + 'dup')
    const { id, created_at, sent_at, ...rest } = p as any
    const { data, error } = await supabase.from('proposals').insert({ ...rest, status: 'rascunho', sent_at: null }).select('*').single()
    setBusy('')
    if (error) { toast(error.message, 'err'); return }
    setListaP(prev => [data as Proposal, ...prev])
  }
  function gerarPDF(p: Proposal) {
    const w = window.open('', '_blank'); if (!w) return
    w.document.write(`<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap;padding:40px;max-width:680px;margin:auto;font-size:14px;line-height:1.6">${(p.conteudo || 'Proposta sem conteúdo.').replace(/</g, '&lt;')}</pre>`)
    w.document.title = `Proposta — ${p.empresa || p.contato_nome || ''}`
    w.document.close(); w.focus(); setTimeout(() => w.print(), 250)
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

  // ──────────────── card de deal
  function DealCard({ d, confirmado, enriquecido }: { d: Deal; confirmado: boolean; enriquecido?: boolean }) {
    const st = stMeta[d.status] ?? { label: d.status, cor: C.muted }
    const editing = editId === d.id
    const nome = d.empresa || d.contato_nome || 'Negócio'
    const conv = convOf(d)
    const r = parseRange(d.valor); const nivel = d.status === 'negociacao' ? 'Quente' : d.status === 'proposta' ? 'Quente' : 'Morno'
    return (
      <div style={{ background: C.deep, border: `1px solid ${confirmado ? 'rgba(34,197,94,0.25)' : `color-mix(in oklch, ${st.cor} 26%, var(--c-border))`}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 17, color: C.white }}>{nome}</span>
            <Badge cor={st.cor}>{st.label}</Badge>
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
              {[['Contato', d.contato_nome], ['Canal', 'WhatsApp'], ['Produto / serviço', d.produto], ['Volume', d.volume], ['Valor estimado', d.valor], ['Status', st.label],
                ...(enriquecido ? [['Nível de interesse', nivel], ['Última interação', fmtDate(d.confirmed_at || d.detected_at)]] : [])
              ].filter(([, v]) => v).map(([k, v]) => (
                <div key={k as string}>
                  <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>{k}</p>
                  <p style={{ fontFamily: FONT.dm, fontSize: 14, color: (k === 'Valor estimado') ? 'var(--c-green)' : C.white, fontWeight: k === 'Valor estimado' ? 500 : 400 }}>{v as string}</p>
                </div>
              ))}
            </div>
            {d.resumo && <div style={{ marginBottom: 12 }}><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>{enriquecido ? 'Motivo da oportunidade' : 'Resumo'}</p><p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.muted, lineHeight: 1.6, fontWeight: 300 }}>{d.resumo}</p></div>}
            <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <p style={{ ...T.mono, color: 'oklch(80% 0.12 215)', fontSize: 9, marginBottom: 4 }}>Próximo passo</p>
              <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>{proximoPasso[d.status] ?? '—'}</p>
            </div>

            {propostas[d.id] && (
              <div style={{ background: C.void, border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ ...T.mono, color: C.blueB, fontSize: 9 }}>Proposta gerada</p>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={() => navigator.clipboard.writeText(propostas[d.id])} style={{ ...linkSt, color: C.blueB }}>copiar</button>
                    {schemaReady && <button onClick={() => { setPForm({ ...novaProposta(), empresa: d.empresa || '', contato: d.contato_nome || '', contact_identifier: d.contact_identifier || '', produto: d.produto || '', valor: d.valor || '', conteudo: propostas[d.id], status: 'rascunho', deal_id: d.id }); setShowPForm(true); setOpen(p => ({ ...p, propostas: true })) }} style={{ ...linkSt, color: 'var(--c-green)' }}>salvar como proposta</button>}
                  </div>
                </div>
                <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{propostas[d.id]}</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {conv && <a href={`/painel/conversas/${conv}`} style={linkSt}>Ver conversa</a>}
              {!confirmado && <button onClick={() => setStatus(d.id, 'confirmed')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Confirmar venda</button>}
              {enriquecido && schemaReady && <button onClick={() => prefillReuniao(d)} style={{ ...linkSt, color: CYAN }}>Marcar reunião</button>}
              <button onClick={() => abrirEdit(d)} style={linkSt}>Editar negócio</button>
              <button onClick={() => gerarProposta(d.id)} disabled={busy === d.id + 'prop'} style={{ ...linkSt, color: C.blueB }}>{busy === d.id + 'prop' ? 'Gerando…' : 'Gerar proposta'}</button>
              {d.status !== 'rejected' && <button onClick={() => setStatus(d.id, 'rejected')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Marcar como perdido</button>}
            </div>
          </>
        )}
      </div>
    )
  }

  function prefillReuniao(d: Deal) {
    setMForm({ ...novaReuniao(), empresa: d.empresa || '', contato: d.contato_nome || '', contact_identifier: d.contact_identifier || '', assunto: d.produto ? `Proposta: ${d.produto}` : '', deal_id: d.id })
    setShowMForm(true); setOpen(p => ({ ...p, agenda: true }))
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ──────────────── card de reunião
  function MeetingCard({ m }: { m: Meeting }) {
    const meta = mMeta[m.status] ?? { label: m.status, cor: C.muted }
    const nome = m.empresa || m.contato_nome || 'Reunião'
    const conv = m.conversation_id || convMap[m.contact_identifier ?? ''] || ''
    const solicitada = SOLIC.includes(m.status)
    const dataSolic = m.requested_date ? `${fmtDate(m.requested_date)}${m.requested_time ? ` às ${m.requested_time}` : ''}` : (m.periodo || null)
    const info: [string, string | null][] = [
      ['Contato', m.contato_nome],
      ['Tipo', m.tipo],
      ['Modalidade', m.modalidade ? (modLabel[m.modalidade] || m.modalidade) : null],
      solicitada
        ? ['Data solicitada', dataSolic]
        : ['Data', m.start_at ? `${fmtDate(m.start_at)} às ${fmtTime(m.start_at)}` : null],
      ['Duração', m.duracao_min ? `${m.duracao_min} min` : null],
      ['Responsável', m.responsavel],
      ['Canal', m.canal], ['Origem', m.origem],
      [m.modalidade === 'presencial' ? 'Endereço' : 'Link', m.modalidade === 'presencial' ? m.endereco : m.meeting_url],
      ['Assunto', m.assunto],
    ]
    const offering = offerId === m.id
    return (
      <div style={{ background: C.deep, border: `1px solid color-mix(in oklch, ${meta.cor} 26%, var(--c-border))`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 17, color: C.white }}>{nome}</span>
            <Badge cor={meta.cor}>{meta.label}</Badge>
            {m.source === 'ai_sugerida' && <Badge cor={CYAN}>IA</Badge>}
          </div>
          {m.start_at && !solicitada && <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint }}>{fmtDate(m.start_at)} · {fmtTime(m.start_at)}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, marginBottom: 12 }}>
          {info.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>{k}</p><p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{v}</p></div>
          ))}
        </div>
        {m.observacoes && <div style={{ marginBottom: 12 }}><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>Observações</p><p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: C.muted, lineHeight: 1.6, fontWeight: 300 }}>{m.observacoes}</p></div>}
        {m.status === 'aguardando_escolha' && Array.isArray(m.alternative_slots) && m.alternative_slots.length > 0 && (
          <div style={{ background: C.void, border: `1px solid color-mix(in oklch, ${CYAN} 28%, transparent)`, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ ...T.mono, color: CYAN, fontSize: 9, marginBottom: 6 }}>Datas oferecidas — aguardando o cliente</p>
            {m.alternative_slots.map((s, i) => <p key={i} style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>• {s.date ? `${fmtDate(s.date)}${s.time ? ` às ${s.time}` : ''}` : '—'}</p>)}
          </div>
        )}
        {m.proximo_passo && (
          <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
            <p style={{ ...T.mono, color: 'oklch(80% 0.12 215)', fontSize: 9, marginBottom: 4 }}>Próximo passo</p>
            <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>{m.proximo_passo}</p>
          </div>
        )}

        {offering && (
          <div style={{ background: C.void, border: `1px solid ${C.borderHi}`, borderRadius: 8, padding: 14, marginBottom: 14 }}>
            <p style={{ ...T.mono, color: CYAN, fontSize: 9, marginBottom: 10 }}>Oferecer novas datas (até 3) — a IA envia as opções ao cliente</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {offerSlots.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 8 }}>
                  <input className="field" type="date" value={s.date} onChange={e => setOfferSlots(prev => prev.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} />
                  <input className="field" type="time" value={s.time} onChange={e => setOfferSlots(prev => prev.map((x, j) => j === i ? { ...x, time: e.target.value } : x))} style={{ width: 130 }} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button onClick={() => enviarOferta(m.id)} disabled={busy === m.id + 'oferecer_datas'} className="btn-primary" style={{ fontSize: 12 }}>{busy === m.id + 'oferecer_datas' ? 'Enviando…' : 'Enviar opções ao cliente'}</button>
              <button onClick={() => setOfferId('')} className="btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
            </div>
          </div>
        )}

        {sendFail[m.id] && (
          <div style={{ background: 'color-mix(in oklch, var(--c-red) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--c-red) 28%, transparent)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: 'var(--c-red)', fontWeight: 300 }}>⚠ Mensagem não enviada ao cliente — {sendFail[m.id].error}</span>
            {sendFail[m.id].messageId && <button onClick={() => reenviar(m.id, sendFail[m.id].messageId)} disabled={busy === m.id + 'reenviar'} className="btn-ghost" style={{ fontSize: 11, padding: '6px 12px', whiteSpace: 'nowrap' }}>{busy === m.id + 'reenviar' ? 'Enviando…' : 'Tentar enviar novamente'}</button>}
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {conv && <a href={`/painel/conversas/${conv}`} style={linkSt}>Ver conversa</a>}
          {m.meeting_url && <a href={m.meeting_url} target="_blank" rel="noreferrer" style={{ ...linkSt, color: CYAN }}>Abrir reunião</a>}
          {['detectada', 'aguardando', 'aguardando_info', 'sugerida', 'aguardando_escolha', 'reagendada'].includes(m.status) &&
            <button onClick={() => meetingAcao(m.id, 'confirmar')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>{busy === m.id + 'confirmar' ? 'Confirmando…' : 'Confirmar horário'}</button>}
          {!['realizada', 'cancelada', 'recusada'].includes(m.status) &&
            <button onClick={() => { setOfferId(offering ? '' : m.id); if (!offering) setOpen(p => ({ ...p, agenda: true })) }} style={{ ...linkSt, color: CYAN }}>Oferecer nova data</button>}
          {!['realizada', 'cancelada', 'recusada'].includes(m.status) && <button onClick={() => reagendar(m)} disabled={!!busy} style={{ ...linkSt, color: CYAN }}>Reagendar</button>}
          {['confirmada', 'reagendada'].includes(m.status) && <button onClick={() => meetingAcao(m.id, 'realizada')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Marcar como realizada</button>}
          {['confirmada', 'reagendada'].includes(m.status) && <button onClick={() => meetingAcao(m.id, 'ausencia')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Marcar ausência</button>}
          {solicitada && <button onClick={() => meetingAcao(m.id, 'recusar')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Recusar</button>}
          {schemaReady && <button onClick={() => prefillProposta(m)} style={{ ...linkSt, color: C.blueB }}>Gerar proposta</button>}
          {!['cancelada', 'recusada', 'realizada'].includes(m.status) && <button onClick={() => meetingAcao(m.id, 'cancelar', { notificar: true })} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Cancelar</button>}
        </div>
      </div>
    )
  }

  // ──────────────── card de proposta
  function ProposalCard({ p }: { p: Proposal }) {
    const meta = pMeta[p.status] ?? { label: p.status, cor: C.muted }
    const nome = p.empresa || p.contato_nome || 'Proposta'
    const conv = convMap[p.contact_identifier ?? ''] || ''
    const info: [string, string | null][] = [
      ['Contato', p.contato_nome], ['Produto / serviço', p.produto], ['Valor estimado', p.valor],
      ['Criada em', fmtDate(p.created_at)], ['Validade', p.validade ? fmtDate(p.validade) : null], ['Responsável', p.responsavel],
    ]
    return (
      <div style={{ background: C.deep, border: `1px solid color-mix(in oklch, ${meta.cor} 26%, var(--c-border))`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 17, color: C.white }}>{nome}</span>
            <Badge cor={meta.cor}>{meta.label}</Badge>
          </div>
          {p.sent_at && <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint }}>Enviada em {fmtDate(p.sent_at)}</span>}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: p.conteudo ? 12 : 0 }}>
          {info.filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>{k}</p><p style={{ fontFamily: FONT.dm, fontSize: 14, color: k === 'Valor estimado' ? 'var(--c-green)' : C.white, fontWeight: k === 'Valor estimado' ? 500 : 400 }}>{v}</p></div>
          ))}
        </div>
        {p.conteudo && <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}><p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>{p.conteudo}</p></div>}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {conv && <a href={`/painel/conversas/${conv}`} style={linkSt}>Ver conversa</a>}
          {(p.status === 'rascunho' || p.status === 'aguardando_envio') && <button onClick={() => setProposalStatus(p.id, 'enviada')} disabled={!!busy} style={{ ...linkSt, color: C.blueB }}>Marcar como enviada</button>}
          <button onClick={() => setProposalStatus(p.id, 'aceita')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Marcar como aceita</button>
          <button onClick={() => setProposalStatus(p.id, 'recusada')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Marcar como recusada</button>
          <button onClick={() => duplicarProposta(p)} disabled={!!busy} style={linkSt}>Duplicar</button>
          <button onClick={() => gerarPDF(p)} style={{ ...linkSt, color: CYAN }}>Gerar PDF</button>
        </div>
      </div>
    )
  }

  // ──────────────── card de negociação
  function NegCard({ d }: { d: Deal }) {
    const conv = convOf(d)
    const dias = daysSince(d.confirmed_at || d.detected_at)
    const prob = PROB[d.status] ?? 40
    const prop = listaP.find(p => p.contact_identifier && p.contact_identifier === d.contact_identifier)
    return (
      <div style={{ background: C.deep, border: `1px solid color-mix(in oklch, var(--c-blue-b) 24%, var(--c-border))`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 17, color: C.white }}>{d.empresa || d.contato_nome || 'Negociação'}</span>
          <Badge cor={stMeta[d.status]?.cor || C.muted}>{stMeta[d.status]?.label || d.status}</Badge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 12 }}>
          {[['Etapa atual', stMeta[d.status]?.label || d.status], ['Valor estimado', d.valor], ['Última interação', dias !== null ? `Há ${dias} dia(s)` : '—'], ['Probabilidade', `${prob}%`]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k}><p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 3 }}>{k}</p><p style={{ fontFamily: FONT.dm, fontSize: 14, color: k === 'Valor estimado' ? 'var(--c-green)' : k === 'Probabilidade' ? CYAN : C.white, fontWeight: k === 'Valor estimado' || k === 'Probabilidade' ? 500 : 400 }}>{v}</p></div>
          ))}
        </div>
        <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
          <p style={{ ...T.mono, color: 'oklch(80% 0.12 215)', fontSize: 9, marginBottom: 4 }}>Próximo passo</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300 }}>{dias !== null && dias >= 7 ? 'Realizar follow-up comercial — negociação parada.' : (proximoPasso[d.status] ?? '—')}</p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          {conv && <a href={`/painel/conversas/${conv}`} style={{ ...linkSt, color: C.blueB }}>Fazer follow-up</a>}
          {conv && <a href={`/painel/conversas/${conv}`} style={linkSt}>Ver conversa</a>}
          {prop && <button onClick={() => setOpen(p => ({ ...p, propostas: true }))} style={linkSt}>Ver proposta</button>}
          {schemaReady && <button onClick={() => prefillReuniao(d)} style={{ ...linkSt, color: CYAN }}>Marcar reunião</button>}
          <button onClick={() => setStatus(d.id, 'confirmed')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-green)' }}>Confirmar venda</button>
          <button onClick={() => setStatus(d.id, 'rejected')} disabled={!!busy} style={{ ...linkSt, color: 'var(--c-red)' }}>Marcar como perdida</button>
        </div>
      </div>
    )
  }

  // ──────────────── seção recolhível
  function Section({ id, titulo, sub, count, cor, children }: { id: string; titulo: string; sub: string; count: number; cor?: string; children: React.ReactNode }) {
    const aberto = open[id]
    return (
      <div>
        <button onClick={() => toggle(id)} style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, marginBottom: aberto ? 14 : 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>{titulo}</h2>
              <span style={{ fontFamily: FONT.jb, fontSize: 10, color: cor || C.muted, background: `color-mix(in oklch, ${cor || 'var(--c-muted)'} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${cor || 'var(--c-muted)'} 26%, transparent)`, borderRadius: 100, padding: '2px 9px' }}>{count}</span>
            </div>
            <p style={{ ...T.sub, fontSize: 12, marginTop: 4 }}>{sub}</p>
          </div>
          <span style={{ color: C.faint, fontSize: 13, transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform .2s', marginTop: 4 }}>▾</span>
        </button>
        {aberto && children}
      </div>
    )
  }

  // ──────────────── funil
  const etapas = [
    { label: 'Conversas', value: funnel.conversas, cor: 'var(--c-blue-b)', desc: 'Atendimentos iniciados pelo agente.' },
    { label: 'Leads', value: funnel.leads, cor: 'var(--c-yellow)', desc: 'Contatos qualificados com interesse real.' },
    { label: 'Oportunidades', value: funnel.oportunidades, cor: CYAN, desc: 'Possíveis vendas detectadas pela IA.' },
    { label: 'Reuniões', value: funnel.reunioes, cor: CYAN, desc: 'Oportunidades que avançaram para conversa agendada.' },
    { label: 'Propostas', value: funnel.propostas, cor: 'var(--c-blue-b)', desc: 'Propostas em aberto aguardando decisão.' },
    { label: 'Vendas', value: funnel.vendas, cor: 'var(--c-green)', desc: 'Negócios fechados e confirmados.' },
  ]
  const taxa = (a: number, b: number) => b > 0 ? Math.round((a / b) * 100) : 0

  const resumoItems: [string, string][] = [
    [`Reuniões marcadas: ${reunMarcadas + reunAguard}`, CYAN],
    [`Reuniões realizadas: ${compareceu}`, 'var(--c-green)'],
    [`Propostas enviadas: ${propEnviadas.length}`, 'var(--c-blue-b)'],
    [`Negociações ativas: ${negociacoes.length}`, 'var(--c-yellow)'],
    [`Vendas confirmadas: ${confirmados.length}`, 'var(--c-green)'],
    [`Receita estimada: ${receita}`, 'var(--c-green)'],
    [`Taxa de comparecimento: ${taxaComparec !== null ? taxaComparec + '%' : '—'}`, CYAN],
    [`Fechamento após reunião: ${taxaFechReun !== null ? taxaFechReun + '%' : '—'}`, 'var(--c-blue-b)'],
  ]

  return (
    <div className="ng-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
      {/* ESQUERDA */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 1. Métricas */}
        <div className="ng-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
          {cards.map(c => (
            <div key={c.label} style={{ ...CARD, borderColor: `color-mix(in oklch, ${c.cor} 22%, var(--c-border))` }}>
              <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{c.label}</p>
              <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: c.small ? 17 : 30, color: c.cor, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{c.value}</p>
              <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{c.desc}</p>
            </div>
          ))}
        </div>

        {/* 2. Funil comercial */}
        <div style={CARD}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Funil comercial</h2>
            <button onClick={exportar} className="btn-ghost" style={{ fontSize: 11, padding: '7px 12px' }}>⬇ Exportar</button>
          </div>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 16 }}>Veja como os atendimentos evoluíram de conversas até vendas confirmadas.</p>
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexWrap: 'wrap' }}>
            {etapas.map((e, i) => (
              <div key={e.label} style={{ display: 'contents' }}>
                <div style={{ flex: 1, minWidth: 120, background: C.void, border: `1px solid color-mix(in oklch, ${e.cor} 24%, var(--c-border))`, borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 26, color: e.cor, lineHeight: 1 }}>{e.value}</p>
                  <p style={{ ...T.mono, fontSize: 9, color: C.muted, marginTop: 6 }}>{e.label}</p>
                  {i > 0 && <p style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint, marginTop: 4 }}>{taxa(e.value, etapas[i - 1].value)}% da etapa anterior</p>}
                  <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 10.5, color: C.muted, marginTop: 6, lineHeight: 1.35 }}>{e.desc}</p>
                </div>
                {i < etapas.length - 1 && <div style={{ display: 'flex', alignItems: 'center', color: C.faint, fontSize: 18 }}>→</div>}
              </div>
            ))}
          </div>
        </div>

        {/* 3. Agenda comercial */}
        <Section id="agenda" titulo="Agenda comercial" sub="Acompanhe reuniões, demonstrações e contatos comerciais relacionados às oportunidades detectadas pelo agente." count={listaM.length} cor={CYAN}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={() => { setShowMForm(s => !s); if (!showMForm) setMForm(novaReuniao()) }} className="btn-primary" style={{ fontSize: 12 }}>{showMForm ? 'Fechar' : '+ Criar reunião'}</button>
            <a href="/painel/leads" className="btn-ghost" style={{ fontSize: 12 }}>Ver oportunidades</a>
            <a href="/painel/conversas" className="btn-ghost" style={{ fontSize: 12 }}>Ver conversas</a>
            {listaM.length > 0 && <button onClick={() => { setLimpar(1); setLimparPeriod('') }} className="btn-ghost" style={{ fontSize: 12, color: C.muted, marginLeft: 'auto' }}>Apagar histórico de reuniões</button>}
          </div>
          {!schemaReady && <NoticeSchema />}
          {showMForm && <MeetingForm form={mForm} setForm={setMForm} onSave={criarReuniao} busy={busy === 'mnew'} onCancel={() => setShowMForm(false)} />}
          {listaM.length === 0 ? (
            <EmptyMeetings onCreate={() => setShowMForm(true)} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <MeetingGroup titulo="Solicitações pendentes" cor="var(--c-yellow)" items={solicitacoesReun} render={m => <MeetingCard key={m.id} m={m} />} />
              <MeetingGroup titulo="Aguardando escolha do cliente" cor={CYAN} items={aguardandoEscolha} render={m => <MeetingCard key={m.id} m={m} />} />
              <MeetingGroup titulo="Reuniões confirmadas" cor="var(--c-green)" items={confirmadasReun} render={m => <MeetingCard key={m.id} m={m} />} />
              <MeetingGroup titulo="Reagendamentos" cor={CYAN} items={reagendadasReun} render={m => <MeetingCard key={m.id} m={m} />} />
              <MeetingGroup titulo="Histórico de reuniões" cor="var(--c-muted)" items={historicoReun} render={m => <MeetingCard key={m.id} m={m} />} />
            </div>
          )}
        </Section>

        {/* 4. Propostas comerciais */}
        <Section id="propostas" titulo="Propostas comerciais" sub="Acompanhe propostas geradas, enviadas e aguardando resposta." count={listaP.length} cor="var(--c-blue-b)">
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <button onClick={() => { setShowPForm(s => !s); if (!showPForm) setPForm(novaProposta()) }} className="btn-primary" style={{ fontSize: 12 }}>{showPForm ? 'Fechar' : '+ Nova proposta'}</button>
          </div>
          {!schemaReady && <NoticeSchema />}
          {showPForm && <ProposalForm form={pForm} setForm={setPForm} onSave={criarProposta} busy={busy === 'pnew'} onCancel={() => setShowPForm(false)} />}
          {listaP.length === 0 ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhuma proposta registrada ainda. Crie uma proposta ou gere uma a partir de uma oportunidade.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{listaP.map(p => <ProposalCard key={p.id} p={p} />)}</div>
          )}
        </Section>

        {/* 5. Negociações em andamento */}
        <Section id="negociacoes" titulo="Negociações em andamento" sub="Oportunidades que já receberam contato, reunião ou proposta e ainda aguardam decisão." count={negociacoes.length} cor="var(--c-yellow)">
          {negociacoes.length === 0 ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhuma negociação em andamento. Quando uma oportunidade avançar para proposta ou negociação, ela aparece aqui.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{negociacoes.map(d => <NegCard key={d.id} d={d} />)}</div>
          )}
        </Section>

        {/* 6. Vendas confirmadas */}
        <Section id="vendas" titulo="Vendas confirmadas" sub="Clientes confirmados pela equipe como venda ou fechamento." count={confirmados.length} cor="var(--c-green)">
          {confirmados.length === 0 ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhuma venda confirmada ainda. Quando você confirmar uma oportunidade, ela aparece aqui.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{confirmados.map(d => <DealCard key={d.id} d={d} confirmado />)}</div>
          )}
        </Section>

        {/* 7. Oportunidades em validação */}
        <Section id="validacao" titulo="Oportunidades em validação" sub="Possíveis vendas detectadas pela IA que ainda precisam de confirmação." count={emValidacao.length} cor="var(--c-yellow)">
          {emValidacao.length === 0 ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhuma oportunidade aguardando confirmação no momento.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{emValidacao.map(d => <DealCard key={d.id} d={d} confirmado={false} enriquecido />)}</div>
          )}
        </Section>

        {/* 8. Negócios perdidos */}
        <Section id="perdidos" titulo="Negócios perdidos" sub="Oportunidades encerradas sem fechamento. Reabra se houver novo interesse." count={perdidos.length} cor="var(--c-red)">
          {perdidos.length === 0 ? (
            <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px', ...T.sub }}>Nenhum negócio perdido registrado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{perdidos.map(d => <DealCard key={d.id} d={d} confirmado={false} />)}</div>
          )}
        </Section>
      </div>

      {/* DIREITA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* Agenda de hoje */}
        <div style={CARD}>
          <h2 style={sideTitle}>Agenda de hoje</h2>
          {proxReuniao ? (
            <div style={{ background: C.void, border: `1px solid color-mix(in oklch, ${CYAN} 25%, transparent)`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
              <span style={{ ...T.mono, fontSize: 8, color: CYAN }}>Próxima reunião</span>
              <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, fontWeight: 500, marginTop: 4 }}>{proxReuniao.empresa || proxReuniao.contato_nome || 'Reunião'}</p>
              <p style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted, marginTop: 2 }}>{proxReuniao.start_at ? `${fmtDate(proxReuniao.start_at)} às ${fmtTime(proxReuniao.start_at)}` : 'Sem data'}{proxReuniao.canal ? ` · ${proxReuniao.canal}` : ''}</p>
            </div>
          ) : (
            <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, marginBottom: 12 }}>Nenhuma reunião marcada no momento.</p>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            {[['Hoje', reunHoje.length, C.white], ['Aguardando', reunAguard, reunAguard > 0 ? 'var(--c-yellow)' : C.white], ['Escolha cliente', aguardandoEscolha.length, aguardandoEscolha.length > 0 ? CYAN : C.white]].map(([l, v, c]) => (
              <div key={l as string} style={{ flex: 1, background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ ...T.mono, fontSize: 8, color: C.faint }}>{l}</span>
                <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: c as string, lineHeight: 1.1, marginTop: 3 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Resumo comercial</h2>
          {resumoItems.map(([t, c], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: c, flexShrink: 0 }} />
              <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span>
            </div>
          ))}
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Insights de venda</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {insights.map((ins, i) => <div key={i} style={{ display: 'flex', gap: 9 }}><span style={{ color: CYAN, fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>✦</span><span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.5 }}>{ins}</span></div>)}
          </div>
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Follow-ups pendentes</h2>
          {followups.length === 0 ? (
            <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>Nenhum follow-up pendente. Tudo em dia por aqui. 🎉</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {followups.slice(0, 6).map((f, i) => (
                <div key={i} style={{ background: C.void, border: `1px solid color-mix(in oklch, ${f.prioridade === 'alta' ? 'var(--c-red)' : 'var(--c-yellow)'} 24%, var(--c-border))`, borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 500 }}>{f.cliente}</span>
                    <Badge cor={f.prioridade === 'alta' ? 'var(--c-red)' : 'var(--c-yellow)'}>{f.prioridade === 'alta' ? 'Alta' : 'Média'}</Badge>
                  </div>
                  <p style={{ fontFamily: FONT.dm, fontSize: 12, color: C.muted, fontWeight: 300, lineHeight: 1.45, marginBottom: 8 }}>{f.motivo}</p>
                  {f.conv
                    ? <a href={`/painel/conversas/${f.conv}`} className="btn-ghost" style={{ fontSize: 11, padding: '6px 12px', display: 'inline-block' }}>Fazer follow-up</a>
                    : <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint }}>{f.prazo}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={CARD}>
          <h2 style={sideTitle}>Próximas ações</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {acoes.slice(0, 6).map((a, i) => (
              a.href
                ? <a key={i} href={a.href} className="nav-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, fontSize: 13, padding: '9px 12px' }}><span style={{ color: C.white }}>{a.titulo}</span><span style={{ fontFamily: FONT.dm, fontSize: 11, color: C.muted, fontWeight: 300 }}>{a.desc}</span></a>
                : <button key={i} onClick={a.onClick} className="nav-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2, fontSize: 13, padding: '9px 12px', width: '100%', textAlign: 'left' }}><span style={{ color: C.white }}>{a.titulo}</span><span style={{ fontFamily: FONT.dm, fontSize: 11, color: C.muted, fontWeight: 300 }}>{a.desc}</span></button>
            ))}
          </div>
        </div>
      </div>

      {/* Apagar histórico de reuniões */}
      {limpar > 0 && (
        <div onClick={() => { if (!limparBusy) { setLimpar(0); setLimparPeriod('') } }} style={{ position: 'fixed', inset: 0, background: 'oklch(10% 0.03 250 / 0.7)', backdropFilter: 'blur(3px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: C.deep, border: `1px solid ${C.borderHi}`, borderRadius: 16, padding: 24, position: 'relative' }}>
            <button onClick={() => { if (!limparBusy) { setLimpar(0); setLimparPeriod('') } }} aria-label="Fechar" style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: C.muted, fontSize: 22, cursor: 'pointer' }}>×</button>
            {limpar === 1 ? (
              <>
                <h2 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 6 }}>Apagar histórico de reuniões</h2>
                <p style={{ ...T.sub, fontSize: 13, marginBottom: 18 }}>Escolha o período. Apaga apenas reuniões já encerradas ou passadas — agendamentos futuros são mantidos.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {[['24h', 'Últimas 24 horas'], ['7d', 'Últimos 7 dias'], ['30d', 'Últimos 30 dias'], ['tudo', 'Todo o histórico']].map(([v, l]) => {
                    const sel = limparPeriod === v; const alerta = v === 'tudo'; const cor = alerta ? 'var(--c-red)' : 'var(--c-blue-b)'
                    return (
                      <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '12px 14px', borderRadius: 10, background: sel ? `color-mix(in oklch, ${cor} 10%, transparent)` : C.void, border: `1px solid ${sel ? `color-mix(in oklch, ${cor} 45%, transparent)` : alerta ? 'rgba(232,64,64,0.25)' : C.border}` }}>
                        <input type="radio" name="limparReun" checked={sel} onChange={() => setLimparPeriod(v)} style={{ accentColor: alerta ? '#e84040' : 'oklch(55% 0.24 225)' }} />
                        <span style={{ fontFamily: FONT.dm, fontSize: 14, fontWeight: 500, color: alerta ? 'var(--c-red)' : C.white }}>{alerta && '⚠ '}{l}</span>
                      </label>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setLimpar(0); setLimparPeriod('') }} className="btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
                  <button onClick={() => setLimpar(2)} disabled={!limparPeriod} className="btn-primary" style={{ fontSize: 13, opacity: limparPeriod ? 1 : 0.5, cursor: limparPeriod ? 'pointer' : 'not-allowed' }}>Apagar histórico</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 18, color: C.white, marginBottom: 12 }}>Confirmar exclusão</h2>
                <div style={{ background: 'rgba(232,64,64,0.08)', border: '1px solid rgba(232,64,64,0.3)', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, fontWeight: 300, lineHeight: 1.55, marginBottom: 10 }}>
                    Esta ação é <b>permanente</b> e não poderá ser desfeita. Apaga somente o histórico de reuniões deste cliente — não afeta conversas, leads, vendas nem agendamentos futuros.
                  </p>
                  <p style={{ fontFamily: FONT.dm, fontSize: 13.5, color: 'var(--c-red)' }}>
                    Período selecionado: <b>{({ '24h': '24 horas', '7d': '7 dias', '30d': '30 dias', tudo: 'todo o histórico' } as any)[limparPeriod]}</b>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button onClick={() => setLimpar(1)} disabled={limparBusy} className="btn-ghost" style={{ fontSize: 13 }}>Cancelar</button>
                  <button onClick={apagarReunioes} disabled={limparBusy} className="btn-primary" style={{ fontSize: 13, background: '#c23030', opacity: limparBusy ? 0.6 : 1 }}>{limparBusy ? 'Apagando…' : 'Confirmar e apagar'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toasts */}
      {toasts.length > 0 && (
        <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 360 }}>
          {toasts.map(t => {
            const cor = t.type === 'ok' ? 'var(--c-green)' : t.type === 'err' ? 'var(--c-red)' : CYAN
            return (
              <div key={t.id} className="animate-slide-up" style={{ background: C.deep, border: `1px solid color-mix(in oklch, ${cor} 40%, var(--c-border))`, borderLeft: `3px solid ${cor}`, borderRadius: 10, padding: '12px 14px', boxShadow: '0 8px 30px oklch(20% 0.05 250 / 0.5)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ color: cor, fontSize: 13, lineHeight: 1.3 }}>{t.type === 'ok' ? '✓' : t.type === 'err' ? '⚠' : 'ℹ'}</span>
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300, lineHeight: 1.45 }}>{t.text}</span>
                <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', color: C.faint, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0, marginLeft: 'auto' }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 1040px){ .ng-grid{ grid-template-columns: 1fr !important; } }
        @media (max-width: 760px){ .ng-cards{ grid-template-columns: repeat(2,1fr) !important; } }
      `}</style>
    </div>
  )
}

// ──────────────────────────────────────────────── subcomponentes auxiliares
function MeetingGroup({ titulo, cor, items, render }: { titulo: string; cor: string; items: Meeting[]; render: (m: Meeting) => React.ReactNode }) {
  if (!items.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: cor }} />
        <span style={{ ...T.mono, fontSize: 10, color: C.muted }}>{titulo}</span>
        <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint }}>({items.length})</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{items.map(render)}</div>
    </div>
  )
}

function EmptyMeetings({ onCreate }: { onCreate: () => void }) {
  return (
    <div style={{ ...CARD, textAlign: 'center', padding: '40px 24px' }}>
      <p style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 6 }}>Nenhuma reunião comercial marcada no momento.</p>
      <p style={{ ...T.sub, fontSize: 13, marginBottom: 18 }}>Quando o agente identificar ou registrar um agendamento, ele aparecerá aqui.</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={onCreate} className="btn-primary" style={{ fontSize: 12 }}>Criar reunião</button>
        <a href="/painel/leads" className="btn-ghost" style={{ fontSize: 12 }}>Ver oportunidades</a>
        <a href="/painel/conversas" className="btn-ghost" style={{ fontSize: 12 }}>Ver conversas</a>
      </div>
    </div>
  )
}

function NoticeSchema() {
  return (
    <div style={{ background: 'color-mix(in oklch, var(--c-yellow) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--c-yellow) 26%, transparent)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
      <p style={{ fontFamily: FONT.dm, fontSize: 12.5, color: 'var(--c-yellow)', fontWeight: 300 }}>Para salvar reuniões e propostas, rode <span style={{ fontFamily: FONT.jb }}>supabase/02_negocios.sql</span> no Supabase. A visualização já está pronta.</p>
    </div>
  )
}

function FormShell({ children }: { children: React.ReactNode }) {
  return <div style={{ ...CARD, marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
}
function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12 }}>{children}</div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={fieldHalf}><label style={T.label}>{label}</label>{children}</div>
}

function MeetingForm({ form, setForm, onSave, busy, onCancel }: { form: any; setForm: (f: any) => void; onSave: () => void; busy: boolean; onCancel: () => void }) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v })
  return (
    <FormShell>
      <Row>
        <Field label="Empresa / lead"><input className="field" value={form.empresa} onChange={e => set('empresa', e.target.value)} /></Field>
        <Field label="Contato"><input className="field" value={form.contato} onChange={e => set('contato', e.target.value)} /></Field>
      </Row>
      <Row>
        <Field label="Data"><input className="field" type="date" value={form.data} onChange={e => set('data', e.target.value)} /></Field>
        <Field label="Horário"><input className="field" type="time" value={form.hora} onChange={e => set('hora', e.target.value)} /></Field>
        <Field label="Duração (min)"><input className="field" type="number" value={form.duracao} onChange={e => set('duracao', e.target.value)} /></Field>
      </Row>
      <Row>
        <Field label="Tipo"><select className="field" value={form.tipo} onChange={e => set('tipo', e.target.value)}>{[['reuniao', 'Reunião comercial'], ['visita', 'Visita presencial'], ['call', 'Call / ligação'], ['demo', 'Demonstração']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Modalidade"><select className="field" value={form.modalidade} onChange={e => set('modalidade', e.target.value)}><option value="">—</option>{[['presencial', 'Presencial'], ['online', 'Online'], ['telefone', 'Telefone']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Status"><select className="field" value={form.status} onChange={e => set('status', e.target.value)}>{[['aguardando', 'Aguardando confirmação'], ['confirmada', 'Confirmada'], ['realizada', 'Realizada']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      </Row>
      <Row>
        <Field label="Canal"><input className="field" placeholder="Google Meet, Zoom…" value={form.canal} onChange={e => set('canal', e.target.value)} /></Field>
        <Field label="Responsável"><input className="field" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} /></Field>
      </Row>
      <Field label="Assunto"><input className="field" value={form.assunto} onChange={e => set('assunto', e.target.value)} /></Field>
      {form.modalidade === 'presencial' && <Field label="Endereço"><input className="field" value={form.endereco} onChange={e => set('endereco', e.target.value)} placeholder="Rua Exemplo, 123" /></Field>}
      <Field label="Link da reunião (opcional)"><input className="field" placeholder="https://meet.google.com/…" value={form.meeting_url} onChange={e => set('meeting_url', e.target.value)} /></Field>
      <Field label="Próximo passo"><input className="field" value={form.proximo_passo} onChange={e => set('proximo_passo', e.target.value)} /></Field>
      <Field label="Observações"><textarea className="field" rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave} disabled={busy} className="btn-primary" style={{ fontSize: 12 }}>{busy ? 'Salvando…' : 'Salvar reunião'}</button>
        <button onClick={onCancel} className="btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
      </div>
    </FormShell>
  )
}

function ProposalForm({ form, setForm, onSave, busy, onCancel }: { form: any; setForm: (f: any) => void; onSave: () => void; busy: boolean; onCancel: () => void }) {
  const set = (k: string, v: any) => setForm({ ...form, [k]: v })
  return (
    <FormShell>
      <Row>
        <Field label="Cliente"><input className="field" value={form.empresa} onChange={e => set('empresa', e.target.value)} /></Field>
        <Field label="Contato"><input className="field" value={form.contato} onChange={e => set('contato', e.target.value)} /></Field>
      </Row>
      <Row>
        <Field label="Produto / serviço"><input className="field" value={form.produto} onChange={e => set('produto', e.target.value)} /></Field>
        <Field label="Valor estimado"><input className="field" value={form.valor} onChange={e => set('valor', e.target.value)} /></Field>
      </Row>
      <Row>
        <Field label="Validade"><input className="field" type="date" value={form.validade} onChange={e => set('validade', e.target.value)} /></Field>
        <Field label="Responsável"><input className="field" value={form.responsavel} onChange={e => set('responsavel', e.target.value)} /></Field>
        <Field label="Status"><select className="field" value={form.status} onChange={e => set('status', e.target.value)}>{[['rascunho', 'Rascunho'], ['aguardando_envio', 'Aguardando envio'], ['enviada', 'Enviada']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
      </Row>
      <Field label="Conteúdo da proposta"><textarea className="field" rows={5} value={form.conteudo} onChange={e => set('conteudo', e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onSave} disabled={busy} className="btn-primary" style={{ fontSize: 12 }}>{busy ? 'Salvando…' : 'Salvar proposta'}</button>
        <button onClick={onCancel} className="btn-ghost" style={{ fontSize: 12 }}>Cancelar</button>
      </div>
    </FormShell>
  )
}

function novaReuniao() {
  return { empresa: '', contato: '', contact_identifier: '', assunto: '', data: '', hora: '', duracao: '30', canal: '', responsavel: '', origem: 'WhatsApp', status: 'aguardando', tipo: 'reuniao', modalidade: '', endereco: '', meeting_url: '', provider: '', observacoes: '', proximo_passo: '', deal_id: null }
}
function novaProposta() {
  return { empresa: '', contato: '', contact_identifier: '', produto: '', valor: '', validade: '', responsavel: '', conteudo: '', status: 'rascunho', deal_id: null }
}
