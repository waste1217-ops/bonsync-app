import { createClient } from '@/lib/supabase/server'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

export default async function AdminConversasPage() {
  const supabase = await createClient()
  const { data: conversas } = await supabase
    .from('conversations')
    .select('*, agents(name, profiles(company_name))')
    .order('started_at', { ascending: false })
    .limit(100)

  const statusStyle: Record<string, React.CSSProperties> = {
    open:      { color: 'var(--c-yellow)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' },
    resolved:  { color: 'var(--c-green)',  background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.2)' },
    escalated: { color: 'var(--c-red)',    background: 'rgba(232,64,64,0.1)',   border: '1px solid rgba(232,64,64,0.2)' },
  }
  const statusLabel: Record<string, string> = { open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado' }

  const total     = conversas?.length ?? 0
  const resolved  = conversas?.filter(c => c.status === 'resolved').length ?? 0
  const escalated = conversas?.filter(c => c.status === 'escalated').length ?? 0

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Todas as conversas
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          Visão global de todos os atendimentos na plataforma.
        </p>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total', value: total },
          { label: 'Resolvidas', value: resolved },
          { label: 'Escaladas', value: escalated },
        ].map(s => (
          <div key={s.label} className="card">
            <p style={{ ...S.mono, color: 'var(--c-muted)', marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 32, color: 'var(--c-blue-b)', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid rgba(80,130,210,0.08)' }}>
          {['Contato', 'Cliente / Agente', 'Canal', 'Status', 'Data'].map(h => (
            <span key={h} style={{ ...S.mono, color: 'var(--c-faint)', fontSize: 9 }}>{h}</span>
          ))}
        </div>

        {!conversas?.length && (
          <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>
            Nenhuma conversa registrada ainda.
          </div>
        )}

        {conversas?.map((c: any) => (
          <div key={c.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr 1fr', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-dm)', fontWeight: 500, fontSize: 14, color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.contact_identifier || 'Anônimo'}
            </span>
            <div>
              <p style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--c-white)' }}>
                {c.agents?.profiles?.company_name ?? '—'}
              </p>
              <p style={{ fontFamily: 'var(--font-jb)', fontSize: 10, color: 'var(--c-muted)', marginTop: 2 }}>
                {c.agents?.name}
              </p>
            </div>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-muted)' }}>{c.channel}</span>
            <span style={{ ...S.mono, fontSize: 9, padding: '4px 10px', borderRadius: 100, width: 'fit-content', ...statusStyle[c.status] }}>
              {statusLabel[c.status]}
            </span>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-faint)' }}>
              {new Date(c.started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
