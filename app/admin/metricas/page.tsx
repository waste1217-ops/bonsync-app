import { createClient } from '@/lib/supabase/server'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

export default async function AdminMetricasPage() {
  const supabase = await createClient()

  const [
    { count: totalClientes },
    { count: totalAgentes },
    { count: totalConversas },
    { count: resolvedConversas },
    { count: escalatedConversas },
    { data: agentesStats },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('agents').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'escalated'),
    supabase.from('agents').select('id, name, status, profiles(company_name), conversations(count)').limit(10),
  ])

  const taxaResolucao = totalConversas ? Math.round(((resolvedConversas ?? 0) / totalConversas) * 100) : 0

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Métricas globais
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          Visão consolidada de toda a plataforma Bonsync.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Clientes ativos',     value: totalClientes ?? 0,    color: 'var(--c-blue-b)' },
          { label: 'Agentes configurados', value: totalAgentes ?? 0,    color: 'var(--c-blue-b)' },
          { label: 'Total de conversas',  value: totalConversas ?? 0,   color: 'var(--c-blue-b)' },
          { label: 'Resolvidas',          value: resolvedConversas ?? 0, color: 'var(--c-green)' },
          { label: 'Escaladas',           value: escalatedConversas ?? 0, color: 'var(--c-red)' },
          { label: 'Taxa de resolução',   value: `${taxaResolucao}%`,   color: taxaResolucao >= 80 ? 'var(--c-green)' : 'var(--c-yellow)' },
        ].map(s => (
          <div key={s.label} className="card">
            <p style={{ ...S.mono, color: 'var(--c-muted)', marginBottom: 10 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 36, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Por agente */}
      <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--c-border)' }}>
          <h2 style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 16, color: 'var(--c-white)' }}>
            Por agente
          </h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid rgba(80,130,210,0.08)' }}>
          {['Agente', 'Cliente', 'Conversas', 'Status'].map(h => (
            <span key={h} style={{ ...S.mono, color: 'var(--c-faint)', fontSize: 9 }}>{h}</span>
          ))}
        </div>

        {!agentesStats?.length && (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>
            Nenhum agente registrado.
          </div>
        )}

        {agentesStats?.map((a: any) => {
          const statusColor: Record<string, string> = { active: 'var(--c-green)', paused: 'var(--c-yellow)', error: 'var(--c-red)' }
          const statusLabel: Record<string, string> = { active: 'Ativo', paused: 'Pausado', error: 'Erro' }
          const convCount = Array.isArray(a.conversations) ? a.conversations[0]?.count ?? 0 : 0
          return (
            <div key={a.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: 16 }}>
              <span style={{ fontFamily: 'var(--font-dm)', fontWeight: 500, fontSize: 14, color: 'var(--c-white)' }}>{a.name}</span>
              <span style={{ fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)' }}>
                {(a.profiles as any)?.company_name ?? '—'}
              </span>
              <span style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 18, color: 'var(--c-blue-b)' }}>{convCount}</span>
              <span style={{ fontFamily: 'var(--font-jb)', fontSize: 10, color: statusColor[a.status] }}>{statusLabel[a.status]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
