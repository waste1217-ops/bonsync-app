import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, TABLE, TABLE_HEADER, badgeStyle, agentStatusVariant, FONT } from '@/lib/styles'
import { estimateCostBRL, fmtTokens, fmtBRL } from '@/lib/usage'

export default async function AdminOverviewPage() {
  const supabase = await createClient()

  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    { data: clientes },
    { data: agents },
    { count: totalConversas },
    { data: tokenTotals },
    { data: subs },
    { data: tokenMes },
  ] = await Promise.all([
    supabase.from('profiles').select('id, email, company_name, created_at, agents(id, name, status)').eq('role', 'client').order('created_at', { ascending: false }),
    supabase.from('agents').select('id, client_id, status, config'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.rpc('agent_token_totals'),
    supabase.from('subscriptions').select('monthly_price, status'),
    supabase.rpc('agent_token_totals_since', { since: inicioMes }),
  ])

  const cls = clientes ?? []
  const ags = agents ?? []

  // ── Clientes ──
  const total = cls.length
  const d30 = Date.now() - 30 * 24 * 60 * 60 * 1000
  const novos30 = cls.filter(c => new Date(c.created_at).getTime() >= d30).length
  const clientesAtivos = new Set(ags.filter(a => a.status === 'active').map(a => a.client_id)).size
  const agentesAtivos = ags.filter(a => a.status === 'active').length

  // ── Consumo / custo (via RPC, somado no servidor) ──
  const agentModel: Record<string, string> = {}
  ags.forEach(a => { agentModel[a.id] = (a.config as any)?.model })
  let totIn = 0, totOut = 0, custoTotal = 0
  ;(tokenTotals ?? []).forEach((t: any) => {
    const inp = Number(t.input_tokens || 0), out = Number(t.output_tokens || 0)
    totIn += inp; totOut += out
    custoTotal += estimateCostBRL({ inputTokens: inp, outputTokens: out }, agentModel[t.agent_id])
  })

  // ── Financeiro ──
  const subsList = subs ?? []
  const mrr = subsList.filter((s: any) => s.status === 'active').reduce((acc: number, s: any) => acc + Number(s.monthly_price || 0), 0)
  const arr = mrr * 12
  const emTeste = subsList.filter((s: any) => s.status === 'trial').length
  const cancelados = subsList.filter((s: any) => s.status === 'cancelled').length
  // Custo de IA do mês atual
  let custoMes = 0
  ;(tokenMes ?? []).forEach((t: any) => {
    custoMes += estimateCostBRL({ inputTokens: Number(t.input_tokens || 0), outputTokens: Number(t.output_tokens || 0) }, agentModel[t.agent_id])
  })
  const lucro = mrr - custoMes

  // ── Crescimento: novos clientes nos últimos 6 meses ──
  const meses: { label: string; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0)
    const ini = d.getTime()
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const count = cls.filter(c => { const t = new Date(c.created_at).getTime(); return t >= ini && t < fim }).length
    meses.push({ label: d.toLocaleDateString('pt-BR', { month: 'short' }), count })
  }
  const maxMes = Math.max(...meses.map(m => m.count), 1)

  const kpis = [
    { label: 'Total de clientes',   value: total,          color: C.blueB },
    { label: 'Clientes ativos',     value: clientesAtivos, color: C.green },
    { label: 'Novos (30 dias)',     value: novos30,        color: C.blueB },
    { label: 'Agentes ativos',      value: agentesAtivos,  color: C.green },
  ]

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Visão geral</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Painel de controle da plataforma Bonsync.</p>
      </div>

      {/* KPIs de clientes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 34, color: k.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Financeiro */}
      <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 12 }}>Financeiro</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'MRR (receita/mês)', value: fmtBRL(mrr),    color: C.green },
          { label: 'ARR (receita/ano)', value: fmtBRL(arr),    color: C.green },
          { label: 'Lucro estimado (mês)', value: fmtBRL(lucro), color: lucro >= 0 ? C.green : C.red },
          { label: 'Em teste',          value: emTeste,        color: C.yellow },
          { label: 'Cancelados',        value: cancelados,     color: C.red },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 24, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Consumo de IA + crescimento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Consumo */}
        <div style={CARD}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 }}>Consumo de IA</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 20 }}>Tokens e custo estimado de toda a plataforma.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            {[
              { label: 'Tokens entrada', value: fmtTokens(totIn),  color: C.blueB },
              { label: 'Tokens saída',   value: fmtTokens(totOut), color: C.blueB },
              { label: 'Custo total',    value: fmtBRL(custoTotal), color: C.yellow },
            ].map(k => (
              <div key={k.label} style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
                <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{k.label}</p>
                <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 22, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                  {k.value}
                </p>
              </div>
            ))}
          </div>
          <p style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint, marginTop: 12 }}>
            * Custo de IA (o que a Bonsync paga). Total de conversas: {totalConversas ?? 0}.
          </p>
        </div>

        {/* Crescimento */}
        <div style={CARD}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 }}>Crescimento</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 20 }}>Novos clientes por mês</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 90 }}>
            {meses.map((m, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: FONT.jb, fontSize: 11, color: C.white }}>{m.count}</span>
                <div style={{ width: '100%', height: Math.max(4, (m.count / maxMes) * 60), background: i === meses.length - 1 ? 'oklch(55% 0.24 225/0.9)' : 'oklch(55% 0.24 225/0.35)', borderRadius: '3px 3px 0 0', transition: 'height .4s' }} />
                <span style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint }}>{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabela de clientes */}
      <div style={TABLE}>
        <div style={TABLE_HEADER}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Clientes recentes</h2>
          <a href="/admin/clientes" style={{ ...T.mono, fontSize: 10, color: C.blueB }}>Ver todos →</a>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr', gap: 16, padding: '10px 24px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Empresa', 'E-mail', 'Agentes', 'Cadastro'].map(h => (
            <span key={h} style={T.tableHead}>{h}</span>
          ))}
        </div>
        {!cls.length && (
          <div style={{ padding: '48px 24px', textAlign: 'center', ...T.sub }}>Nenhum cliente cadastrado ainda.</div>
        )}
        {cls.slice(0, 8).map((c: any) => (
          <a key={c.id} href={`/admin/clientes/${c.id}`} className="trow"
            style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 1fr', gap: 16, cursor: 'pointer' }}>
            <span style={T.cell}>{c.company_name || '—'}</span>
            <span style={T.cellMuted}>{c.email}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {c.agents?.length > 0
                ? c.agents.map((a: any) => (<span key={a.id} style={badgeStyle(agentStatusVariant(a.status))}>{a.name}</span>))
                : <span style={{ ...T.mono, color: C.faint }}>nenhum</span>}
            </div>
            <span style={T.cellMono}>{new Date(c.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
