import { createClient } from '@/lib/supabase/server'

export default async function PainelConversasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: agent } = await supabase
    .from('agents').select('id').eq('client_id', user!.id).single()

  const { data: conversas } = await supabase
    .from('conversations')
    .select('*')
    .eq('agent_id', agent?.id ?? '')
    .order('started_at', { ascending: false })

  const statusColor: Record<string, string> = {
    open: 'text-yellow bg-yellow/10 border-yellow/20',
    resolved: 'text-green bg-green/10 border-green/20',
    escalated: 'text-red bg-red/10 border-red/20',
  }
  const statusLabel: Record<string, string> = {
    open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado',
  }

  return (
    <div className="animate-slide-up max-w-6xl">
      <div className="mb-8">
        <h1 className="font-heading font-bold text-2xl text-white tracking-tight">Conversas</h1>
        <p className="text-muted text-sm font-light mt-1">
          {conversas?.length ?? 0} conversa{conversas?.length !== 1 ? 's' : ''} registrada{conversas?.length !== 1 ? 's' : ''}.
        </p>
      </div>

      <div className="bg-deep border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-5 gap-4 px-6 py-3 border-b border-border/50">
          {['Contato', 'Canal', 'Status', 'Mensagens', 'Data'].map(h => (
            <span key={h} className="font-mono text-[9px] text-faint tracking-widest uppercase">{h}</span>
          ))}
        </div>

        {!conversas?.length && (
          <div className="px-6 py-16 text-center text-muted text-sm font-light">
            Nenhuma conversa registrada ainda. Elas aparecerão aqui quando o agente começar a atender.
          </div>
        )}

        {conversas?.map(c => (
          <div key={c.id} className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-border/40 hover:bg-surface/30 transition-colors">
            <span className="text-white text-sm font-medium truncate">{c.contact_identifier || 'Anônimo'}</span>
            <span className="text-muted font-mono text-xs">{c.channel}</span>
            <span className={`font-mono text-[9px] px-2 py-0.5 rounded-full border self-center w-fit ${statusColor[c.status]}`}>
              {statusLabel[c.status]}
            </span>
            <span className="text-muted text-sm">{c.message_count}</span>
            <span className="text-faint font-mono text-xs">
              {new Date(c.started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
