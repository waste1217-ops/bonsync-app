import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { NotificationsPanel, type Notif } from '@/components/NotificationsPanel'

export const dynamic = 'force-dynamic'

function formatContact(id: string | null): string {
  if (!id) return 'Contato'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  return num || 'Contato'
}

export default async function NotificacoesPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
  const { data: agent } = await supabase.from('agents').select('id, name, status').eq('client_id', user!.id).single()
  const agentId = agent?.id ?? ''

  const [{ data: qualificados }, { data: escaladas }, { data: pendentes }] = await Promise.all([
    supabase.from('conversations').select('id, contact_identifier, lead_reason, lead_updated_at')
      .eq('agent_id', agentId).eq('lead_status', 'qualificado').order('lead_updated_at', { ascending: false }).limit(20),
    supabase.from('conversations').select('id, contact_identifier, started_at, ended_at')
      .eq('agent_id', agentId).eq('status', 'escalated').order('started_at', { ascending: false }).limit(20),
    supabase.from('deals').select('id, contato_nome, contact_identifier, detected_at')
      .eq('agent_id', agentId).eq('status', 'pending').order('detected_at', { ascending: false }).limit(20),
  ])

  const notifs: Notif[] = []

  if (agent?.status === 'error') {
    notifs.push({
      id: 'agent-error', tipo: 'agente', prioridade: 'alta',
      title: 'Seu agente está com erro',
      descricao: 'O agente foi pausado automaticamente. Verifique o status ou fale com a Bonsync.',
      motivo: 'Falha técnica', ts: new Date().toISOString(), href: '/painel/status',
    })
  }

  for (const c of qualificados ?? []) {
    notifs.push({
      id: `lead-${c.id}`, tipo: 'lead', prioridade: 'media',
      title: 'Novo lead qualificado',
      descricao: 'A IA identificou alta intenção de compra nesta conversa — vale priorizar.',
      contato: formatContact(c.contact_identifier), canal: 'WhatsApp',
      motivo: c.lead_reason || 'Intenção de compra detectada',
      ts: c.lead_updated_at || new Date().toISOString(), href: `/painel/conversas/${c.id}`,
    })
  }

  for (const c of escaladas ?? []) {
    notifs.push({
      id: `esc-${c.id}`, tipo: 'conversa', prioridade: 'media',
      title: 'Conversa encaminhada para humano',
      descricao: 'O agente identificou que esta conversa precisa de atendimento da equipe.',
      contato: formatContact(c.contact_identifier), canal: 'WhatsApp',
      motivo: 'Atendimento humano solicitado',
      ts: c.ended_at || c.started_at, href: `/painel/conversas/${c.id}`,
    })
  }

  for (const d of pendentes ?? []) {
    notifs.push({
      id: `deal-${d.id}`, tipo: 'venda', prioridade: 'info',
      title: 'Negócio detectado',
      descricao: 'Um possível fechamento foi identificado. Confirme para registrar como cliente.',
      contato: d.contato_nome || formatContact(d.contact_identifier), canal: 'WhatsApp',
      motivo: 'Possível fechamento', ts: d.detected_at, href: '/painel/negocios',
    })
  }

  // ── Reuniões e propostas (tolerante: tabelas podem não existir ainda) ──
  const [mRes, pRes] = await Promise.all([
    supabase.from('meetings').select('id, empresa, contato_nome, contact_identifier, start_at, status, canal, created_at').eq('agent_id', agentId).order('start_at', { ascending: true }),
    supabase.from('proposals').select('id, empresa, contato_nome, contact_identifier, status, sent_at, created_at').eq('agent_id', agentId).in('status', ['enviada', 'visualizada', 'em_negociacao']),
  ])
  const meetings = mRes.error ? [] : mRes.data ?? []
  const propostas = pRes.error ? [] : pRes.data ?? []
  const agoraMs = Date.now()
  const nomeM = (m: any) => m.empresa || m.contato_nome || formatContact(m.contact_identifier)

  for (const m of meetings) {
    const startMs = m.start_at ? new Date(m.start_at).getTime() : null
    const emUmaHora = startMs !== null && startMs - agoraMs > 0 && startMs - agoraMs <= 70 * 60000
    if (m.status === 'confirmada' && emUmaHora) {
      notifs.push({ id: `meet-1h-${m.id}`, tipo: 'venda', prioridade: 'alta', title: 'Reunião em 1 hora', descricao: `Você tem uma reunião com ${nomeM(m)} em menos de 1 hora.`, contato: nomeM(m), canal: m.canal || 'WhatsApp', motivo: 'Reunião próxima', ts: m.start_at, href: '/painel/negocios' })
    } else if (m.status === 'confirmada') {
      notifs.push({ id: `meet-ok-${m.id}`, tipo: 'venda', prioridade: 'info', title: 'Reunião marcada', descricao: `Reunião confirmada com ${nomeM(m)}.`, contato: nomeM(m), canal: m.canal || 'WhatsApp', motivo: 'Reunião confirmada', ts: m.start_at || m.created_at, href: '/painel/negocios' })
    } else if (m.status === 'aguardando') {
      notifs.push({ id: `meet-wait-${m.id}`, tipo: 'venda', prioridade: 'media', title: 'Reunião aguardando confirmação', descricao: `A reunião com ${nomeM(m)} ainda precisa ser confirmada.`, contato: nomeM(m), canal: m.canal || 'WhatsApp', motivo: 'Aguardando confirmação', ts: m.created_at || m.start_at, href: '/painel/negocios' })
    } else if (m.status === 'cancelada') {
      notifs.push({ id: `meet-cancel-${m.id}`, tipo: 'venda', prioridade: 'baixa', title: 'Reunião cancelada', descricao: `A reunião com ${nomeM(m)} foi cancelada.`, contato: nomeM(m), canal: m.canal || 'WhatsApp', motivo: 'Cancelada', ts: m.start_at || m.created_at, href: '/painel/negocios' })
    } else if (m.status === 'ausente') {
      notifs.push({ id: `meet-noshow-${m.id}`, tipo: 'venda', prioridade: 'media', title: 'Cliente não compareceu', descricao: `${nomeM(m)} não compareceu à reunião. Vale reagendar.`, contato: nomeM(m), canal: m.canal || 'WhatsApp', motivo: 'Ausência', ts: m.start_at || m.created_at, href: '/painel/negocios' })
    }
  }

  for (const p of propostas) {
    const dias = Math.floor((agoraMs - new Date(p.sent_at || p.created_at).getTime()) / 86400000)
    if (dias >= 3) {
      notifs.push({ id: `prop-fup-${p.id}`, tipo: 'venda', prioridade: 'media', title: 'Proposta aguardando follow-up', descricao: `A proposta para ${p.empresa || p.contato_nome || 'cliente'} está sem resposta há ${dias} dias.`, contato: p.empresa || p.contato_nome || formatContact(p.contact_identifier), canal: 'WhatsApp', motivo: 'Follow-up de proposta', ts: p.sent_at || p.created_at, href: '/painel/negocios' })
    }
  }

  notifs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Notificações</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Veja alertas importantes sobre conversas, leads, vendas e funcionamento do agente.</p>
      </div>
      <NotificationsPanel notifs={notifs} />
    </div>
  )
}
