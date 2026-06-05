import { createClient } from '@/lib/supabase/server'
import { ClientConversations } from '@/components/ClientConversations'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

export default async function AdminConversasPage() {
  const supabase = await createClient()
  const { data: conversas } = await supabase
    .from('conversations')
    .select('*, agents(name, profiles(company_name))')
    .order('started_at', { ascending: false })
    .limit(300)

  const all       = conversas ?? []
  const total     = all.length
  const resolved  = all.filter(c => c.status === 'resolved').length
  const escalated = all.filter(c => c.status === 'escalated').length

  // Agrupa por cliente (empresa)
  const grupos: Record<string, { empresa: string; convs: any[] }> = {}
  for (const c of all) {
    const empresa = (c.agents as any)?.profiles?.company_name ?? 'Sem cliente'
    if (!grupos[empresa]) grupos[empresa] = { empresa, convs: [] }
    grupos[empresa].convs.push(c)
  }
  const gruposOrdenados = Object.values(grupos).sort((a, b) => b.convs.length - a.convs.length)

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Conversas por cliente
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          Clique em um cliente para ver os atendimentos dele.
        </p>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Clientes', value: gruposOrdenados.length },
          { label: 'Total de conversas', value: total },
          { label: 'Resolvidas', value: resolved },
          { label: 'Escaladas', value: escalated },
        ].map(s => (
          <div key={s.label} className="card">
            <p style={{ ...S.mono, color: 'var(--c-muted)', fontSize: 9, marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 30, color: 'var(--c-blue-b)', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {!all.length ? (
        <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>
          Nenhuma conversa registrada ainda.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {gruposOrdenados.map(g => (
            <ClientConversations key={g.empresa} empresa={g.empresa} convs={g.convs} />
          ))}
        </div>
      )}
    </div>
  )
}
