import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { FaturamentoCentral } from '@/components/FaturamentoCentral'
import type { Deal } from '@/components/NegociosCentral'

export const dynamic = 'force-dynamic'

export default async function FaturamentoPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
  const { data: agent } = await supabase.from('agents').select('id, name, config').eq('client_id', user!.id).single()
  const aid = agent?.id ?? ''

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  const [{ data: deals }, { data: convs }] = await Promise.all([
    supabase.from('deals').select('*').eq('agent_id', aid).order('detected_at', { ascending: false }),
    supabase.from('conversations').select('id, contact_identifier, started_at').eq('agent_id', aid).order('started_at', { ascending: false }).limit(1000),
  ])
  const convMap: Record<string, string> = {}
  for (const c of convs ?? []) { if (c.contact_identifier && !convMap[c.contact_identifier]) convMap[c.contact_identifier] = c.id }

  return (
    <FaturamentoCentral
      deals={(deals ?? []) as Deal[]} convMap={convMap}
      agentId={aid} agentName={agent.name} config={agent.config || {}}
    />
  )
}
