import { createClient } from '@/lib/supabase/server'

export default async function PainelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('client_id', user!.id)
    .single()

  const { count: totalConversas } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent?.id ?? '')

  const { count: resolvedConversas } = await supabase
    .from('conversations')
    .select('*', { count: 'exact', head: true })
    .eq('agent_id', agent?.id ?? '')
    .eq('status', 'resolved')

  const { data: recentConversas } = await supabase
    .from('conversations')
    .select('*')
    .eq('agent_id', agent?.id ?? '')
    .order('started_at', { ascending: false })
    .limit(5)

  const statusColor: Record<string, string> = {
    active: 'text-green', paused: 'text-yellow', error: 'text-red',
  }
  const statusLabel: Record<string, string> = {
    active: 'Ativo', paused: 'Pausado', error: 'Erro',
  }
  const convStatusColor: Record<string, string> = {
    open: 'text-yellow', resolved: 'text-green', escalated: 'text-red',
  }
  const convStatusLabel: Record<string, string> = {
    open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado',
  }

  if (!agent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="font-heading font-bold text-xl text-white mb-2">Nenhum agente configurado</div>
          <p className="text-muted text-sm font-light">Entre em contato com a Bonsync para configurar seu agente.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-slide-up max-w-5xl">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-white tracking-tight">Visão geral</h1>
        <p className="text-muted text-sm font-light mt-1">Painel do seu agente Bonsync.</p>
      </div>

      {/* Agent status card */}
      <div className="bg-deep border border-border-hi rounded-xl p-6 mb-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-48 h-48 rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle at top right, oklch(55% 0.24 225/0.1) 0%, transparent 65%)' }} />
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted tracking-widest uppercase mb-2">Seu agente</div>
            <h2 className="font-heading font-bold text-xl text-white mb-3">{agent.name}</h2>
            {agent.description && (
              <p className="text-muted text-sm font-light max-w-md">{agent.description}</p>
            )}
          </div>
          <div className={`flex items-center gap-2 font-mono text-xs tracking-wider px-3 py-1.5 rounded-full border
            ${agent.status === 'active' ? 'text-green bg-green/10 border-green/20'
              : agent.status === 'paused' ? 'text-yellow bg-yellow/10 border-yellow/20'
              : 'text-red bg-red/10 border-red/20'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-green animate-pulse-dot' : agent.status === 'paused' ? 'bg-yellow' : 'bg-red'}`} />
            {statusLabel[agent.status]}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total de conversas', value: totalConversas ?? 0 },
          { label: 'Resolvidas', value: resolvedConversas ?? 0 },
          { label: 'Taxa de resolução', value: totalConversas ? `${Math.round(((resolvedConversas ?? 0) / totalConversas) * 100)}%` : '—' },
        ].map(s => (
          <div key={s.label} className="bg-deep border border-border rounded-xl p-5">
            <p className="font-mono text-[10px] text-muted tracking-widest uppercase mb-3">{s.label}</p>
            <p className="font-heading font-bold text-3xl text-blue-bright tracking-tight">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent conversations */}
      <div className="bg-deep border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-heading font-semibold text-base text-white">Conversas recentes</h2>
          <a href="/painel/conversas" className="font-mono text-[10px] text-blue-bright tracking-wider hover:underline no-underline">
            Ver todas →
          </a>
        </div>

        <div className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-border/50">
          {['Contato', 'Canal', 'Status', 'Data'].map(h => (
            <span key={h} className="font-mono text-[9px] text-faint tracking-widest uppercase">{h}</span>
          ))}
        </div>

        {!recentConversas?.length && (
          <div className="px-6 py-12 text-center text-muted text-sm font-light">
            Nenhuma conversa registrada ainda.
          </div>
        )}

        {recentConversas?.map(c => (
          <div key={c.id} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-border/40 hover:bg-surface/30 transition-colors">
            <span className="text-white text-sm font-medium truncate">{c.contact_identifier || 'Anônimo'}</span>
            <span className="text-muted text-sm font-mono text-xs">{c.channel}</span>
            <span className={`font-mono text-[10px] ${convStatusColor[c.status]}`}>{convStatusLabel[c.status]}</span>
            <span className="text-faint font-mono text-xs">{new Date(c.started_at).toLocaleDateString('pt-BR')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
