import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, TABLE, FONT, badgeStyle } from '@/lib/styles'

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) : '—'

const statusVariant = (s: string) => s === 'confirmed' ? 'green' : s === 'rejected' ? 'red' : 'yellow'
const statusLabel: Record<string, string> = { confirmed: 'Cliente', rejected: 'Descartado', pending: 'Pendente' }

export default async function AdminNegociosPage() {
  const supabase = await createClient()

  const { data: deals } = await supabase
    .from('deals')
    .select('*, agents(name, profiles(company_name))')
    .order('detected_at', { ascending: false })
    .limit(200)

  const all       = deals ?? []
  const confirmed = all.filter(d => d.status === 'confirmed')
  const pending   = all.filter(d => d.status === 'pending')

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Negócios</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Visão global de fechamentos detectados em todos os clientes.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Clientes fechados', value: confirmed.length,    color: C.green },
          { label: 'Pendentes',         value: pending.length,      color: C.yellow },
          { label: 'Total detectado',   value: all.length,          color: C.blueB },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 34, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div style={TABLE}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.5fr 1fr 1fr 0.8fr', gap: 16, padding: '10px 24px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Empresa', 'Cliente (contratante)', 'Produto', 'Valor', 'Status', 'Detectado'].map(h => (
            <span key={h} style={T.tableHead}>{h}</span>
          ))}
        </div>

        {!all.length && (
          <div style={{ padding: '60px 24px', textAlign: 'center', ...T.sub }}>
            Nenhum negócio detectado ainda na plataforma.
          </div>
        )}

        {all.map((d: any) => (
          <div key={d.id} className="trow" style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1.5fr 1fr 1fr 0.8fr', gap: 16 }}>
            <span style={T.cell}>{d.empresa || '—'}</span>
            <div>
              <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white }}>{d.agents?.profiles?.company_name ?? '—'}</p>
              <p style={{ fontFamily: FONT.jb, fontSize: 10, color: C.muted, marginTop: 2 }}>{d.agents?.name}</p>
            </div>
            <span style={T.cellMuted}>{d.produto || '—'}</span>
            <span style={T.cellMuted}>{d.valor || '—'}</span>
            <span style={badgeStyle(statusVariant(d.status))}>{statusLabel[d.status]}</span>
            <span style={T.cellMono}>{fmtDate(d.detected_at)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
