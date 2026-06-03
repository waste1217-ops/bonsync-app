import { createClient } from '@/lib/supabase/server'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

export default async function AdminAgentesPage() {
  const supabase = await createClient()
  const { data: agentes } = await supabase
    .from('agents')
    .select('*, profiles(id, email, company_name)')
    .order('created_at', { ascending: false })

  const statusStyle: Record<string, React.CSSProperties> = {
    active: { color: 'var(--c-green)',  background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.2)' },
    paused: { color: 'var(--c-yellow)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' },
    error:  { color: 'var(--c-red)',    background: 'rgba(232,64,64,0.1)',   border: '1px solid rgba(232,64,64,0.2)' },
  }
  const statusLabel: Record<string, string> = { active: 'Ativo', paused: 'Pausado', error: 'Erro' }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
            Agentes
          </h1>
          <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
            {agentes?.length ?? 0} agente{agentes?.length !== 1 ? 's' : ''} configurado{agentes?.length !== 1 ? 's' : ''} na plataforma.
          </p>
        </div>
        <a href="/admin/agentes/novo" className="btn-primary">+ Novo agente</a>
      </div>

      <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid rgba(80,130,210,0.08)' }}>
          {['Agente', 'Cliente', 'Modelo Anthropic', 'Status', 'Criado'].map(h => (
            <span key={h} style={{ ...S.mono, color: 'var(--c-faint)', fontSize: 9 }}>{h}</span>
          ))}
        </div>

        {!agentes?.length && (
          <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>
            Nenhum agente criado ainda.{' '}
            <a href="/admin/agentes/novo" style={{ color: 'var(--c-blue-b)' }}>Criar o primeiro</a>
          </div>
        )}

        {agentes?.map((a: any) => (
          <a key={a.id} href={`/admin/agentes/${a.id}`}
            className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr 1fr', gap: 16, cursor: 'pointer' }}>
            <div>
              <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 500, fontSize: 14, color: 'var(--c-white)', marginBottom: 2 }}>{a.name}</p>
              {a.description && (
                <p style={{ fontFamily: 'var(--font-dm)', fontSize: 12, color: 'var(--c-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.description}</p>
              )}
            </div>
            <div>
              <p style={{ fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-white)' }}>
                {(a.profiles as any)?.company_name || '—'}
              </p>
              <p style={{ fontFamily: 'var(--font-jb)', fontSize: 10, color: 'var(--c-muted)', marginTop: 2 }}>
                {(a.profiles as any)?.email}
              </p>
            </div>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-blue-b)' }}>
              {a.config?.model ?? 'não definido'}
            </span>
            <span style={{ ...S.mono, fontSize: 9, padding: '4px 10px', borderRadius: 100, width: 'fit-content', ...statusStyle[a.status] }}>
              {statusLabel[a.status]}
            </span>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-faint)' }}>
              {new Date(a.created_at).toLocaleDateString('pt-BR')}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
