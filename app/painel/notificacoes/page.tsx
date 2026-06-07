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
  const { data: { user } } = await supabase.auth.getUser()
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
