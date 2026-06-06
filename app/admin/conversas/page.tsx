import { createClient } from '@/lib/supabase/server'
import { AdminConversasBrowser, type Conv } from '@/components/AdminConversasBrowser'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

export default async function AdminConversasPage() {
  const supabase = await createClient()
  const { data: conversas } = await supabase
    .from('conversations')
    .select('id, contact_identifier, channel, status, started_at, is_favorite, agents(name, profiles(company_name))')
    .order('started_at', { ascending: false })
    .limit(500)

  const all = conversas ?? []
  const total     = all.length
  const resolved  = all.filter(c => c.status === 'resolved').length
  const escalated = all.filter(c => c.status === 'escalated').length
  const favoritos = all.filter((c: any) => c.is_favorite).length

  const itens: Conv[] = all.map((c: any) => ({
    id: c.id,
    contact_identifier: c.contact_identifier,
    channel: c.channel,
    status: c.status,
    started_at: c.started_at,
    is_favorite: c.is_favorite ?? false,
    empresa: c.agents?.profiles?.company_name ?? 'Sem cliente',
    agente: c.agents?.name ?? '—',
  }))

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Conversas
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          Busque, filtre, favorite e exporte os atendimentos de todos os clientes.
        </p>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total de conversas', value: total },
          { label: 'Resolvidas', value: resolved },
          { label: 'Escaladas', value: escalated },
          { label: 'Favoritas', value: favoritos },
        ].map(s => (
          <div key={s.label} className="card">
            <p style={{ ...S.mono, color: 'var(--c-muted)', fontSize: 9, marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 30, color: 'var(--c-blue-b)', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <AdminConversasBrowser conversas={itens} />
    </div>
  )
}
