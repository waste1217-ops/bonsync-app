import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { AgendaCentral, type AgMeeting } from '@/components/AgendaCentral'
import { getSegmento, camposEfetivos } from '@/lib/segmentos'

export const dynamic = 'force-dynamic'

const toArr = (v: any): string[] => Array.isArray(v) ? v.filter(Boolean)
  : String(v || '').split(',').map(s => s.trim()).filter(Boolean)

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
  const { data: agent } = await supabase.from('agents').select('id, config').eq('client_id', user!.id).single()
  const aid = agent?.id ?? ''

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  const sched = (agent.config as any)?.scheduling ?? {}
  const seg = getSegmento(sched.segmento)
  const campos = camposEfetivos(seg, sched.campos)
  const profissionais = toArr(sched.responsibles ?? sched.profissionais)
  const servicos = toArr(sched.servicos)

  const [meetingsRes, { data: convs }] = await Promise.all([
    supabase.from('meetings').select('*').eq('agent_id', aid).order('start_at', { ascending: true }),
    supabase.from('conversations').select('id, contact_identifier, started_at').eq('agent_id', aid).order('started_at', { ascending: false }).limit(1000),
  ])
  const meetings = (meetingsRes.error ? [] : meetingsRes.data ?? []) as AgMeeting[]
  const schemaReady = !meetingsRes.error

  const convMap: Record<string, string> = {}
  for (const c of convs ?? []) { if (c.contact_identifier && !convMap[c.contact_identifier]) convMap[c.contact_identifier] = c.id }

  return (
    <AgendaCentral
      meetings={meetings} agentId={aid} seg={seg} campos={campos}
      profissionais={profissionais} servicos={servicos} convMap={convMap} schemaReady={schemaReady}
    />
  )
}
