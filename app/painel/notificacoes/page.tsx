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
      .eq('agent_id', agentId).eq('lead_status', 'qualificado')
      .order('lead_updated_at', { ascending: false }).limit(20),
    supabase.from('conversations').select('id, contact_identifier, started_at, ended_at')
      .eq('agent_id', agentId).eq('status', 'escalated')
      .order('started_at', { ascending: false }).limit(20),
    supabase.from('deals').select('id, contato_nome, contact_identifier, detected_at')
      .eq('agent_id', agentId).eq('status', 'pending')
      .order('detected_at', { ascending: false }).limit(20),
  ])

  const notifs: Notif[] = []

  if (agent?.status === 'error') {
    notifs.push({
      id: 'agent-error', kind: 'agente', sev: 'alta',
      title: 'Seu agente está com erro',
      detail: 'O agente foi pausado automaticamente. Verifique o status ou fale com a Bonsync.',
      ts: new Date().toISOString(), href: '/painel/status',
    })
  }

  for (const c of qualificados ?? []) {
    notifs.push({
      id: `lead-${c.id}`, kind: 'lead', sev: 'media',
      title: `🔥 Lead qualificado: ${formatContact(c.contact_identifier)}`,
      detail: c.lead_reason || 'Alta intenção de compra — vale priorizar o atendimento.',
      ts: c.lead_updated_at || new Date().toISOString(), href: `/painel/conversas/${c.id}`,
    })
  }

  for (const c of escaladas ?? []) {
    notifs.push({
      id: `esc-${c.id}`, kind: 'escalonamento', sev: 'media',
      title: `Conversa precisa de você: ${formatContact(c.contact_identifier)}`,
      detail: 'O atendimento foi encaminhado para uma pessoa da sua equipe.',
      ts: c.ended_at || c.started_at, href: `/painel/conversas/${c.id}`,
    })
  }

  for (const d of pendentes ?? []) {
    notifs.push({
      id: `deal-${d.id}`, kind: 'negocio', sev: 'info',
      title: `Negócio detectado: ${d.contato_nome || formatContact(d.contact_identifier)}`,
      detail: 'Confirme na aba Negócios para registrar como cliente.',
      ts: d.detected_at, href: '/painel/negocios',
    })
  }

  notifs.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())

  return (
    <div className="animate-slide-up" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Notificações</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Tudo que precisa da sua atenção, em um só lugar.</p>
      </div>
      <NotificationsPanel notifs={notifs} />
    </div>
  )
}
