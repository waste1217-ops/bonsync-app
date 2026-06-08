import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { NegociosCentral, type Deal } from '@/components/NegociosCentral'

export const dynamic = 'force-dynamic'

export default async function NegociosPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user!.id).single()
  const aid = agent?.id ?? ''

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  const [{ data: deals }, { count: totalConv }, { count: qualif }, { data: convs }] = await Promise.all([
    supabase.from('deals').select('*').eq('agent_id', aid).order('detected_at', { ascending: false }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', aid),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', aid).eq('lead_status', 'qualificado'),
    supabase.from('conversations').select('id, contact_identifier, started_at').eq('agent_id', aid).order('started_at', { ascending: false }).limit(1000),
  ])

  const all = (deals ?? []) as Deal[]

  // Mapa contato → conversa mais recente (para "Ver conversa")
  const convMap: Record<string, string> = {}
  for (const c of convs ?? []) { if (c.contact_identifier && !convMap[c.contact_identifier]) convMap[c.contact_identifier] = c.id }

  const funnel = {
    conversas: totalConv ?? 0,
    leads: qualif ?? 0,
    oportunidades: all.filter(d => d.status !== 'rejected').length,
    vendas: all.filter(d => d.status === 'confirmed').length,
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Negócios</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Acompanhe vendas, oportunidades fechadas e clientes que demonstraram intenção real de compra nas conversas.</p>
      </div>
      <NegociosCentral deals={all} funnel={funnel} convMap={convMap} />
    </div>
  )
}
