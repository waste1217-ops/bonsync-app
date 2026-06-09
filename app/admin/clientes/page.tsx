import { createClient } from '@/lib/supabase/server'
import { C, T, L, TABLE, TABLE_HEADER, FONT, badgeStyle, agentStatusVariant } from '@/lib/styles'

export const dynamic = 'force-dynamic'

export default async function AdminClientesPage() {
  const supabase = await createClient()
  const { data: clientes } = await supabase
    .from('profiles')
    .select('id, email, company_name, responsavel, active, created_at, agents(id, name, status)')
    .eq('role', 'client')
    .order('created_at', { ascending: false })

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>

      {/* Header */}
      <div style={L.pageHeader}>
        <div>
          <h1 style={T.h1}>Clientes</h1>
          <p style={{ ...T.sub, marginTop: 4 }}>
            {clientes?.length ?? 0} cliente{clientes?.length !== 1 ? 's' : ''} na plataforma.
          </p>
        </div>
        <a href="/admin/clientes/novo" className="btn-primary">+ Novo cliente</a>
      </div>

      {/* Tabela */}
      <div style={TABLE}>
        {/* Col headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.6fr 1.2fr 1.4fr 1fr', gap: 16, padding: '10px 24px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Empresa', 'E-mail', 'Responsável', 'Agentes', 'Cadastro'].map(h => (
            <span key={h} style={T.tableHead}>{h}</span>
          ))}
        </div>

        {/* Vazio */}
        {!clientes?.length && (
          <div style={{ padding: '64px 24px', textAlign: 'center', ...T.sub }}>
            Nenhum cliente cadastrado ainda.{' '}
            <a href="/admin/clientes/novo" style={{ color: C.blueB }}>Criar o primeiro</a>
          </div>
        )}

        {/* Rows */}
        {clientes?.map((c: any) => (
          <a key={c.id} href={`/admin/clientes/${c.id}`}
            className="trow"
            style={{ display: 'grid', gridTemplateColumns: '2fr 1.6fr 1.2fr 1.4fr 1fr', gap: 16, cursor: 'pointer' }}>
            <span style={{ ...T.cell, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {c.company_name || '—'}
              {c.active === false && <span style={badgeStyle('red')}>suspenso</span>}
            </span>
            <span style={T.cellMuted}>{c.email}</span>
            <span style={T.cellMuted}>{c.responsavel || '—'}</span>
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
