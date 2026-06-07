import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { StatusCentral } from './StatusCentral'

export const dynamic = 'force-dynamic'

const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

async function evolutionStatus(instance?: string): Promise<boolean | null> {
  if (!instance) return null
  const url = process.env.EVOLUTION_API_URL, key = process.env.EVOLUTION_API_KEY
  if (!url || !key) return null
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 6000)
    const res = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: key }, signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    const found = (Array.isArray(data) ? data : []).find((i: any) => i.name === instance)
    if (!found) return false
    return (found.connectionStatus || '') === 'open'
  } catch { return null }
}

export default async function PainelStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: agent } = await supabase.from('agents').select('*').eq('client_id', user!.id).single()

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  const aid = agent.id
  const [{ data: ultConv }, { data: ultEsc }, { count: knowledgeCount }, { count: escaladas }, waConnected] = await Promise.all([
    supabase.from('conversations').select('started_at').eq('agent_id', aid).order('started_at', { ascending: false }).limit(1).single(),
    supabase.from('conversations').select('started_at').eq('agent_id', aid).eq('status', 'escalated').order('started_at', { ascending: false }).limit(1).single(),
    supabase.from('knowledge_base').select('*', { count: 'exact', head: true }).eq('agent_id', aid).eq('active', true),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', aid).eq('status', 'escalated').gte('started_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    evolutionStatus((agent.config as any)?.whatsapp_instance),
  ])

  const ultimaAtividade = ultConv?.started_at ?? agent.updated_at ?? agent.created_at

  // Eventos (log amigável)
  const ev: { ts: string; texto: string; cor?: string }[] = []
  if (ultConv?.started_at) ev.push({ ts: ultConv.started_at, texto: 'Última conversa recebida' })
  if (ultEsc?.started_at) ev.push({ ts: ultEsc.started_at, texto: 'Conversa encaminhada para humano', cor: 'var(--c-yellow)' })
  if (agent.updated_at) ev.push({ ts: agent.updated_at, texto: 'Configuração atualizada' })
  if (agent.created_at) ev.push({ ts: agent.created_at, texto: 'Agente criado' })
  const eventos = ev.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 5).map(e => ({ quando: fmt(e.ts), texto: e.texto, cor: e.cor }))

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Status do agente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Monitore se o agente está online, acompanhe canais conectados e controle quando ele deve responder automaticamente.</p>
      </div>
      <StatusCentral
        agentId={aid}
        nome={agent.name}
        status={agent.status}
        config={agent.config}
        waConnected={waConnected}
        ultimaAtividade={ultimaAtividade}
        ultimaMsg={ultConv?.started_at ?? null}
        eventos={eventos}
        knowledgeCount={knowledgeCount ?? 0}
        escaladas={escaladas ?? 0}
      />
    </div>
  )
}
