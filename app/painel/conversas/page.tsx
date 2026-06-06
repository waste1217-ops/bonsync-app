import { createClient } from '@/lib/supabase/server'
import { ClientConversasBrowser, type ClientConv } from '@/components/ClientConversasBrowser'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

export default async function PainelConversasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: agent } = await supabase
    .from('agents').select('id').eq('client_id', user!.id).single()

  const { data: conversas } = await supabase
    .from('conversations')
    .select('id, contact_identifier, channel, status, started_at, message_count')
    .eq('agent_id', agent?.id ?? '')
    .order('started_at', { ascending: false })
    .limit(500)

  const all = (conversas ?? []) as ClientConv[]
  const total     = all.length
  const resolved  = all.filter(c => c.status === 'resolved').length
  const escalated = all.filter(c => c.status === 'escalated').length
  const open      = all.filter(c => c.status === 'open').length

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Conversas
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          Todos os atendimentos do seu agente. Busque, filtre e exporte quando precisar.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total', value: total },
          { label: 'Em aberto', value: open },
          { label: 'Resolvidas', value: resolved },
          { label: 'Com atendente', value: escalated },
        ].map(s => (
          <div key={s.label} className="card">
            <p style={{ ...S.mono, color: 'var(--c-muted)', fontSize: 9, marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 30, color: 'var(--c-blue-b)', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <ClientConversasBrowser conversas={all} />
    </div>
  )
}
