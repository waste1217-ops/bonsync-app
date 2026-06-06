import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT, badgeStyle } from '@/lib/styles'
import { estimateCostBRL, fmtBRL } from '@/lib/usage'

export const dynamic = 'force-dynamic'

type Sev = 'alta' | 'media' | 'baixa'
interface Alerta { sev: Sev; tipo: string; titulo: string; detalhe: string; href?: string }

const sevOrder: Record<Sev, number> = { alta: 0, media: 1, baixa: 2 }
const sevVariant: Record<Sev, 'red' | 'yellow' | 'muted'> = { alta: 'red', media: 'yellow', baixa: 'muted' }
const sevLabel: Record<Sev, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }

// Limites de custo mensal por agente (BRL)
const CUSTO_MEDIO = 50
const CUSTO_ALTO = 150

async function evolutionStatus(): Promise<Record<string, string> | null> {
  const url = process.env.EVOLUTION_API_URL, key = process.env.EVOLUTION_API_KEY
  if (!url || !key) return null
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 7000)
    const res = await fetch(`${url}/instance/fetchInstances`, { headers: { apikey: key }, signal: ctrl.signal, cache: 'no-store' })
    clearTimeout(t)
    if (!res.ok) return null
    const data = await res.json()
    const map: Record<string, string> = {}
    for (const i of (Array.isArray(data) ? data : [])) map[i.name] = i.connectionStatus || 'unknown'
    return map
  } catch { return null }
}

export default async function AdminAlertasPage() {
  const supabase = await createClient()
  const agora = Date.now()
  const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const d60 = new Date(agora - 60 * 86400000).toISOString()

  const [
    { data: clientes },
    { data: agentes },
    { data: subs },
    { data: convs60 },
    { data: tokensMes },
    { data: knowledge },
    instancias,
  ] = await Promise.all([
    supabase.from('profiles').select('id, company_name, email, created_at, active').eq('role', 'client'),
    supabase.from('agents').select('id, name, client_id, status, config'),
    supabase.from('subscriptions').select('client_id, due_date, status'),
    supabase.from('conversations').select('agent_id, started_at, status').gte('started_at', d60).limit(8000),
    supabase.rpc('agent_token_totals_since', { since: inicioMes }),
    supabase.from('knowledge_base').select('agent_id, updated_at, created_at'),
    evolutionStatus(),
  ])

  const cls = clientes ?? []
  const ags = agentes ?? []
  const nomeCliente: Record<string, string> = {}
  cls.forEach((c: any) => { nomeCliente[c.id] = c.company_name || c.email })
  const clienteCriado: Record<string, number> = {}
  cls.forEach((c: any) => { clienteCriado[c.id] = new Date(c.created_at).getTime() })

  const alertas: Alerta[] = []

  // ── 1. Vencimentos ──
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  for (const s of subs ?? []) {
    if (!s.due_date || s.status === 'cancelled') continue
    const venc = new Date(s.due_date + 'T00:00:00')
    const dias = Math.round((venc.getTime() - hoje.getTime()) / 86400000)
    if (dias > 5) continue
    const nome = nomeCliente[s.client_id] || '—'
    if (dias < 0) alertas.push({ sev: 'alta', tipo: 'Cobrança', titulo: `${nome} — pagamento vencido`, detalhe: `Venceu há ${Math.abs(dias)} dia(s).`, href: `/admin/clientes/${s.client_id}` })
    else alertas.push({ sev: 'media', tipo: 'Cobrança', titulo: `${nome} — vencimento próximo`, detalhe: dias === 0 ? 'Vence hoje.' : `Vence em ${dias} dia(s).`, href: `/admin/clientes/${s.client_id}` })
  }

  // ── 2. Última atividade por cliente (60d) ──
  const agToCliente: Record<string, string> = {}
  ags.forEach((a: any) => { agToCliente[a.id] = a.client_id })
  const ultimaPorCliente: Record<string, number> = {}
  for (const c of convs60 ?? []) {
    const cid = agToCliente[c.agent_id]
    if (!cid) continue
    const t = new Date(c.started_at).getTime()
    if (!ultimaPorCliente[cid] || t > ultimaPorCliente[cid]) ultimaPorCliente[cid] = t
  }
  const clientesComAgenteAtivo = new Set(ags.filter((a: any) => a.status === 'active').map((a: any) => a.client_id))
  for (const cid of clientesComAgenteAtivo) {
    const criado = clienteCriado[cid] ?? agora
    if (agora - criado < 14 * 86400000) continue // cliente novo, ignora
    const ult = ultimaPorCliente[cid]
    if (!ult) {
      alertas.push({ sev: 'alta', tipo: 'Engajamento', titulo: `${nomeCliente[cid]} — sem uso`, detalhe: 'Nenhuma conversa nos últimos 60 dias.', href: `/admin/clientes/${cid}` })
    } else {
      const diasSem = Math.round((agora - ult) / 86400000)
      if (diasSem >= 14) alertas.push({ sev: 'media', tipo: 'Engajamento', titulo: `${nomeCliente[cid]} — uso em queda`, detalhe: `Última conversa há ${diasSem} dias.`, href: `/admin/clientes/${cid}` })
    }
  }

  // ── 3. Alto consumo de IA (mês) por agente ──
  const modeloAgente: Record<string, string> = {}
  ags.forEach((a: any) => { modeloAgente[a.id] = a.config?.model })
  const nomeAgente: Record<string, string> = {}
  ags.forEach((a: any) => { nomeAgente[a.id] = a.name })
  for (const t of (tokensMes ?? []) as any[]) {
    const custo = estimateCostBRL({ inputTokens: Number(t.input_tokens || 0), outputTokens: Number(t.output_tokens || 0) }, modeloAgente[t.agent_id])
    if (custo < CUSTO_MEDIO) continue
    const nome = nomeAgente[t.agent_id] ?? 'Agente'
    const emp = nomeCliente[agToCliente[t.agent_id]] ?? '—'
    alertas.push({
      sev: custo >= CUSTO_ALTO ? 'alta' : 'media',
      tipo: 'Consumo',
      titulo: `${nome} (${emp}) — alto consumo de IA`,
      detalhe: `${fmtBRL(custo)} em IA neste mês.`,
      href: `/admin/agentes/${t.agent_id}`,
    })
  }

  // ── 4. WhatsApp / integração ──
  for (const a of ags) {
    const inst = a.config?.whatsapp_instance
    if (a.status === 'error') {
      alertas.push({ sev: 'alta', tipo: 'Integração', titulo: `${a.name} — agente com erro`, detalhe: 'Status do agente está marcado como "erro".', href: `/admin/agentes/${a.id}` })
    }
    if (a.status === 'active' && inst && instancias) {
      const st = instancias[inst]
      if (st !== 'open') {
        alertas.push({ sev: 'alta', tipo: 'Integração', titulo: `${a.name} — WhatsApp desconectado`, detalhe: st ? `Instância "${inst}" está "${st}".` : `Instância "${inst}" não encontrada na Evolution.`, href: `/admin/instancias` })
      }
    }
  }

  // ── 5. Escalonamentos recorrentes (60d) ──
  const porAgente: Record<string, { total: number; esc: number }> = {}
  for (const c of convs60 ?? []) {
    const r = (porAgente[c.agent_id] ??= { total: 0, esc: 0 })
    r.total++; if (c.status === 'escalated') r.esc++
  }
  for (const [aid, r] of Object.entries(porAgente)) {
    if (r.total >= 5 && r.esc / r.total >= 0.4) {
      alertas.push({ sev: 'media', tipo: 'Qualidade', titulo: `${nomeAgente[aid] ?? 'Agente'} — muitos escalonamentos`, detalhe: `${Math.round((r.esc / r.total) * 100)}% das ${r.total} conversas foram escaladas (60d).`, href: `/admin/agentes/${aid}` })
    }
  }

  // ── 6. Conhecimento desatualizado ──
  const ultimaKnow: Record<string, number> = {}
  for (const k of knowledge ?? []) {
    const t = new Date(k.updated_at || k.created_at).getTime()
    if (!ultimaKnow[k.agent_id] || t > ultimaKnow[k.agent_id]) ultimaKnow[k.agent_id] = t
  }
  for (const a of ags) {
    if (a.status !== 'active') continue
    const t = ultimaKnow[a.id]
    if (!t) {
      alertas.push({ sev: 'baixa', tipo: 'Conhecimento', titulo: `${a.name} — sem base de conhecimento`, detalhe: 'Agente ativo sem nenhum item de conhecimento.', href: `/admin/agentes/${a.id}` })
    } else if (agora - t > 90 * 86400000) {
      alertas.push({ sev: 'baixa', tipo: 'Conhecimento', titulo: `${a.name} — conhecimento desatualizado`, detalhe: `Sem atualização há ${Math.round((agora - t) / 86400000)} dias.`, href: `/admin/agentes/${a.id}` })
    }
  }

  alertas.sort((a, b) => sevOrder[a.sev] - sevOrder[b.sev])
  const cont = { alta: alertas.filter(a => a.sev === 'alta').length, media: alertas.filter(a => a.sev === 'media').length, baixa: alertas.filter(a => a.sev === 'baixa').length }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Alertas</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Pontos que merecem atenção na operação, gerados automaticamente.</p>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        {([['alta', C.red], ['media', C.yellow], ['baixa', C.muted]] as [Sev, string][]).map(([s, color]) => (
          <div key={s} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{sevLabel[s]}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 32, color, lineHeight: 1 }}>{cont[s]}</p>
          </div>
        ))}
      </div>

      {instancias === null && (
        <div style={{ ...CARD, marginBottom: 16, borderColor: 'rgba(245,158,11,0.3)' }}>
          <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.yellow }}>
            ⚠️ Status da Evolution indisponível — alertas de WhatsApp desconectado não foram verificados.
          </p>
        </div>
      )}

      {!alertas.length ? (
        <div style={{ ...CARD, textAlign: 'center', padding: '56px 24px' }}>
          <p style={{ fontSize: 30, marginBottom: 12 }}>✅</p>
          <p style={{ fontFamily: FONT.dm, fontSize: 15, color: C.white }}>Tudo certo! Nenhum alerta no momento.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alertas.map((a, i) => {
            const inner = (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ ...badgeStyle(sevVariant[a.sev]), flexShrink: 0 }}>{sevLabel[a.sev]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: FONT.dm, fontWeight: 500, fontSize: 14, color: C.white }}>{a.titulo}</p>
                  <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{a.detalhe}</p>
                </div>
                <span style={{ ...T.mono, fontSize: 9, color: C.faint, flexShrink: 0 }}>{a.tipo}</span>
              </div>
            )
            return a.href
              ? <a key={i} href={a.href} className="card" style={{ display: 'block', cursor: 'pointer' }}>{inner}</a>
              : <div key={i} className="card">{inner}</div>
          })}
        </div>
      )}
    </div>
  )
}
