import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'
import { estimateCostBRL, fmtBRL } from '@/lib/usage'

export const dynamic = 'force-dynamic'

export default async function AdminFinanceiroPage() {
  const supabase = await createClient()
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    { data: clientes },
    { data: subs },
    { data: agentes },
    { data: tokensMes },
    { data: pagamentosMes },
  ] = await Promise.all([
    supabase.from('profiles').select('id, company_name, email').eq('role', 'client'),
    supabase.from('subscriptions').select('client_id, monthly_price, status, plan_name'),
    supabase.from('agents').select('id, client_id, config'),
    supabase.rpc('agent_token_totals_since', { since: inicioMes }),
    supabase.from('payments').select('client_id, amount, paid_at').gte('paid_at', inicioMes.slice(0, 10)),
  ])

  const cls = clientes ?? []
  const ags = agentes ?? []

  // mapeamentos
  const subDe: Record<string, any> = {}
  ;(subs ?? []).forEach((s: any) => { subDe[s.client_id] = s })
  const modeloAgente: Record<string, string> = {}
  const clienteDeAgente: Record<string, string> = {}
  ags.forEach((a: any) => { modeloAgente[a.id] = a.config?.model; clienteDeAgente[a.id] = a.client_id })

  // custo de IA do mês por cliente
  const custoCliente: Record<string, number> = {}
  for (const t of (tokensMes ?? []) as any[]) {
    const cid = clienteDeAgente[t.agent_id]
    if (!cid) continue
    const c = estimateCostBRL({ inputTokens: Number(t.input_tokens || 0), outputTokens: Number(t.output_tokens || 0) }, modeloAgente[t.agent_id])
    custoCliente[cid] = (custoCliente[cid] ?? 0) + c
  }

  // recebido no mês por cliente
  const recebidoCliente: Record<string, number> = {}
  for (const p of (pagamentosMes ?? []) as any[]) {
    recebidoCliente[p.client_id] = (recebidoCliente[p.client_id] ?? 0) + Number(p.amount || 0)
  }

  // linhas por cliente
  const linhas = cls.map((c: any) => {
    const sub = subDe[c.id]
    const ativo = sub?.status === 'active'
    const receita = ativo ? Number(sub?.monthly_price || 0) : 0
    const custo = custoCliente[c.id] ?? 0
    const lucro = receita - custo
    const margem = receita > 0 ? Math.round((lucro / receita) * 100) : null
    return {
      id: c.id,
      nome: c.company_name || c.email,
      plano: sub?.plan_name || '—',
      status: sub?.status || 'sem assinatura',
      receita, custo, lucro, margem,
      recebido: recebidoCliente[c.id] ?? 0,
    }
  }).sort((a, b) => b.lucro - a.lucro)

  const mrr = linhas.reduce((s, l) => s + l.receita, 0)
  const custoTotal = linhas.reduce((s, l) => s + l.custo, 0)
  const lucroTotal = mrr - custoTotal
  const recebidoTotal = linhas.reduce((s, l) => s + l.recebido, 0)
  const margemTotal = mrr > 0 ? Math.round((lucroTotal / mrr) * 100) : 0

  const statusBadge = (s: string) => s === 'active' ? 'green' : s === 'trial' ? 'yellow' : 'muted'
  const statusTxt: Record<string, string> = { active: 'Ativo', trial: 'Teste', cancelled: 'Cancelado', 'sem assinatura': '—' }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1040 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Financeiro</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Receita, custo de IA e margem real por cliente (mês atual).</p>
      </div>

      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'MRR (receita/mês)', value: fmtBRL(mrr), color: C.green },
          { label: 'Custo de IA (mês)', value: fmtBRL(custoTotal), color: C.yellow },
          { label: 'Lucro estimado', value: fmtBRL(lucroTotal), color: lucroTotal >= 0 ? C.green : C.red },
          { label: 'Margem', value: `${margemTotal}%`, color: margemTotal >= 50 ? C.green : C.yellow },
          { label: 'Recebido no mês', value: fmtBRL(recebidoTotal), color: C.blueB },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 22, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabela por cliente */}
      <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${C.border}` }}>
          {['Cliente', 'Receita', 'Custo IA', 'Lucro', 'Recebido', 'Margem'].map(h => <span key={h} style={T.tableHead}>{h}</span>)}
        </div>
        {!linhas.length && (
          <div style={{ padding: '48px 24px', textAlign: 'center', ...T.sub }}>Nenhum cliente cadastrado.</div>
        )}
        {linhas.map(l => (
          <a key={l.id} href={`/admin/clientes/${l.id}`} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 14, color: C.white, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nome}</p>
              <span style={{ ...badgeStyle(statusBadge(l.status)), marginTop: 4 }}>{statusTxt[l.status] ?? l.status}</span>
            </div>
            <span style={{ fontFamily: FONT.jb, fontSize: 12, color: C.muted }}>{fmtBRL(l.receita)}</span>
            <span style={{ fontFamily: FONT.jb, fontSize: 12, color: C.yellow }}>{fmtBRL(l.custo)}</span>
            <span style={{ fontFamily: FONT.jb, fontSize: 12, color: l.lucro >= 0 ? C.green : C.red }}>{fmtBRL(l.lucro)}</span>
            <span style={{ fontFamily: FONT.jb, fontSize: 12, color: C.blueB }}>{fmtBRL(l.recebido)}</span>
            <span style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 13, color: l.margem === null ? C.faint : l.margem >= 50 ? C.green : l.margem >= 0 ? C.yellow : C.red }}>
              {l.margem === null ? '—' : `${l.margem}%`}
            </span>
          </a>
        ))}
      </div>

      <p style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint, marginTop: 14 }}>
        * Receita conta apenas assinaturas com status "Ativo". Custo de IA é estimado pelos tokens do mês e modelo de cada agente.
        Registre os pagamentos na página de cada cliente.
      </p>
    </div>
  )
}
