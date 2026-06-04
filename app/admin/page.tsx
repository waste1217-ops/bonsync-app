import { createClient } from '@/lib/supabase/server'
import { C, T, L, CARD, TABLE, TABLE_COL_HEADER, TABLE_HEADER, TABLE_ROW, badgeStyle, agentStatusVariant, agentStatusLabel, FONT } from '@/lib/styles'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const [
    { count: totalClientes },
    { count: totalAgentes },
    { count: totalConversas },
    { data: clientes },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
    supabase.from('agents').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('profiles')
      .select('id, email, company_name, created_at, agents(id, name, status)')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const kpis = [
    { label: 'Clientes ativos',      value: totalClientes  ?? 0 },
    { label: 'Agentes configurados', value: totalAgentes   ?? 0 },
    { label: 'Conversas registradas',value: totalConversas ?? 0 },
  ]

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Visão geral</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Todos os clientes e agentes da plataforma Bonsync.</p>
      </div>

      {/* KPIs */}
      <div style={L.grid3}>
        {kpis.map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, marginBottom: 12 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 40, color: C.blueB, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela de clientes */}
      <div style={TABLE}>
        <div style={TABLE_HEADER}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>
            Clientes recentes
          </h2>
          <a href="/admin/clientes" style={{ ...T.mono, fontSize: 10, color: C.blueB }}>
            Ver todos →
          </a>
        </div>

        {/* Col headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr', gap: 16, padding: '10px 24px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Empresa', 'E-mail', 'Agentes', 'Cadastro'].map(h => (
            <span key={h} style={T.tableHead}>{h}</span>
          ))}
        </div>

        {/* Vazio */}
        {!clientes?.length && (
          <div style={{ padding: '48px 24px', textAlign: 'center', ...T.sub }}>
            Nenhum cliente cadastrado ainda.
          </div>
        )}

        {/* Rows */}
        {clientes?.map((c: any) => (
          <a key={c.id} href={`/admin/clientes/${c.id}`}
            className="trow"
            style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr', gap: 16, cursor: 'pointer' }}>
            <span style={T.cell}>{c.company_name || '—'}</span>
            <span style={T.cellMuted}>{c.email}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {c.agents?.length > 0
                ? c.agents.map((a: any) => (
                    <span key={a.id} style={badgeStyle(agentStatusVariant(a.status))}>
                      {a.name}
                    </span>
                  ))
                : <span style={{ ...T.mono, color: C.faint }}>nenhum</span>
              }
            </div>
            <span style={T.cellMono}>{new Date(c.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
