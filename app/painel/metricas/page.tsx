import { createClient } from '@/lib/supabase/server'
import { C, T, L, CARD, FONT } from '@/lib/styles'

function BarChart({ data, height = 80 }: { data: number[]; height?: number }) {
  const max = Math.max(...data, 1)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1,
          height: Math.max(4, (v / max) * height),
          background: i === data.length - 1 ? 'oklch(55% 0.24 225/0.9)' : 'oklch(55% 0.24 225/0.3)',
          borderRadius: '3px 3px 0 0',
          transition: 'height .4s',
        }} />
      ))}
    </div>
  )
}

export default async function PainelMetricasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: agent } = await supabase
    .from('agents').select('id, name, status').eq('client_id', user!.id).single()

  // Busca conversas dos últimos 7 dias
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: conversas7d },
    { data: conversas30d },
    { count: totalAll },
  ] = await Promise.all([
    supabase.from('conversations').select('*').eq('agent_id', agent?.id ?? '').gte('started_at', since7d),
    supabase.from('conversations').select('*').eq('agent_id', agent?.id ?? '').gte('started_at', since30d),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', agent?.id ?? ''),
  ])

  const c7   = conversas7d  ?? []
  const c30  = conversas30d ?? []
  const tot7 = c7.length
  const res7 = c7.filter(c => c.status === 'resolved').length
  const esc7 = c7.filter(c => c.status === 'escalated').length
  const taxa = tot7 ? Math.round((res7 / tot7) * 100) : 0

  // Volume diário dos últimos 7 dias
  const dias = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })
  const volumeDiario = dias.map(d =>
    c7.filter(c => c.started_at?.slice(0, 10) === d).length
  )

  // Canais
  const canais = ['whatsapp', 'email', 'site'].map(ch => ({
    nome: ch === 'whatsapp' ? 'WhatsApp' : ch === 'email' ? 'E-mail' : 'Site',
    count: c30.filter(c => c.channel === ch).length,
    pct: c30.length ? Math.round((c30.filter(c => c.channel === ch).length / c30.length) * 100) : 0,
  }))

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  return (
    <div className="animate-slide-up" style={{ maxWidth: 900 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Métricas</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Desempenho do agente <strong style={{ color: C.white }}>{agent.name}</strong>.</p>
      </div>

      {/* KPIs — últimos 7 dias */}
      <p style={{ ...T.mono, color: C.muted, marginBottom: 12 }}>Últimos 7 dias</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Atendimentos',    value: tot7,           color: C.blueB },
          { label: 'Resolvidos',      value: res7,           color: C.green },
          { label: 'Escalados',       value: esc7,           color: C.yellow },
          { label: 'Taxa resolução',  value: `${taxa}%`,     color: taxa >= 80 ? C.green : C.yellow },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 32, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Gráfico de volume diário */}
      <div style={{ ...CARD, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 }}>
              Volume diário
            </h2>
            <p style={{ ...T.sub, fontSize: 12 }}>Atendimentos por dia na última semana</p>
          </div>
          <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.blueB, background: 'oklch(55% 0.24 225/0.12)', border: '1px solid oklch(55% 0.24 225/0.25)', padding: '5px 12px', borderRadius: 100 }}>
            {tot7} total
          </span>
        </div>
        <BarChart data={volumeDiario} height={90} />
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          {dias.map(d => (
            <span key={d} style={{ ...T.mono, color: C.faint, fontSize: 9 }}>
              {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', weekday: 'short' })}
            </span>
          ))}
        </div>
      </div>

      {/* Distribuição por canal + histórico total */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={CARD}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 }}>
            Por canal
          </h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 20 }}>Últimos 30 dias</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {canais.map(ch => (
              <div key={ch.nome}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{ch.nome}</span>
                  <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.muted }}>{ch.count} msgs</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'rgba(80,130,210,0.12)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${ch.pct}%`, background: 'oklch(55% 0.24 225)', borderRadius: 3, transition: 'width .6s ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={CARD}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 }}>
            Histórico total
          </h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 20 }}>Desde o início</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { label: 'Total de conversas', value: totalAll ?? 0, color: C.blueB },
              { label: 'Resolvidas (30d)',   value: c30.filter(c => c.status === 'resolved').length,  color: C.green },
              { label: 'Escaladas (30d)',    value: c30.filter(c => c.status === 'escalated').length, color: C.yellow },
              { label: 'Em aberto (30d)',    value: c30.filter(c => c.status === 'open').length,      color: C.muted },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ ...T.mono, color: C.muted, fontSize: 9 }}>{s.label}</span>
                <span style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 22, color: s.color, letterSpacing: '-0.02em' }}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
