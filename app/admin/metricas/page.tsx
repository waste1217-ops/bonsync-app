import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'
import { BarChart, RankBars, type Bar } from '@/components/BarChart'

export const dynamic = 'force-dynamic'

const STOPWORDS = new Set(['a','o','e','é','de','do','da','que','em','um','uma','para','com','não','nao','os','as','no','na','se','por','mais','dos','das','ao','à','aos','às','meu','minha','seu','sua','isso','isto','esse','essa','este','esta','como','mas','ou','já','ja','eu','você','voce','vc','me','te','lhe','nos','vos','ele','ela','eles','elas','foi','ser','está','esta','estou','tem','ter','vai','quero','queria','pode','poderia','sim','bom','boa','dia','tarde','noite','oi','olá','ola','obrigado','obrigada','por favor','favor','aqui','ali','lá','la','tudo','bem','então','entao','tá','ta','né','ne','pra','pro','até','ate','sobre','quanto','qual','quais','onde','quando','sou','the'])

function fmtDay(d: Date) { return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }) }

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const agora = Date.now()
  const d30 = new Date(agora - 30 * 86400000).toISOString()
  const d180 = new Date(agora - 180 * 86400000).toISOString()

  const [
    { count: totalConversas },
    { count: resolvidas },
    { count: escaladas },
    { data: convs180 },
    { data: agentes },
    { data: msgs30 },
  ] = await Promise.all([
    supabase.from('conversations').select('*', { count: 'exact', head: true }),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('status', 'escalated'),
    supabase.from('conversations').select('id, started_at, status, agent_id').gte('started_at', d180).order('started_at', { ascending: true }).limit(8000),
    supabase.from('agents').select('id, name, client_id, profiles(company_name)'),
    supabase.from('messages').select('conversation_id, role, content, created_at').gte('created_at', d30).order('conversation_id', { ascending: true }).order('created_at', { ascending: true }).limit(10000),
  ])

  const conversas = convs180 ?? []
  const ags = agentes ?? []
  const mensagens = msgs30 ?? []

  const taxaResol = totalConversas ? Math.round(((resolvidas ?? 0) / totalConversas) * 100) : 0
  const taxaErro  = totalConversas ? Math.round(((escaladas ?? 0) / totalConversas) * 100) : 0

  // ── Conversas por dia (30d) ──
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const diaMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) {
    const dt = new Date(agora - i * 86400000)
    diaMap[dt.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })] = 0
  }
  for (const c of conversas) {
    const k = dayKey(c.started_at)
    if (k in diaMap) diaMap[k]++
  }
  // mostra a cada ~3 dias o rótulo para não poluir
  const diasArr = Object.keys(diaMap)
  const porDia: Bar[] = diasArr.map((k, i) => ({
    label: i % 3 === 0 ? fmtDay(new Date(k + 'T12:00:00')) : '',
    value: diaMap[k],
  }))
  const convs30Total = Object.values(diaMap).reduce((a, b) => a + b, 0)

  // ── Conversas por mês (6 meses) ──
  const meses: Bar[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i, 1); d.setHours(0, 0, 0, 0)
    const ini = d.getTime()
    const fim = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime()
    const count = conversas.filter(c => { const t = new Date(c.started_at).getTime(); return t >= ini && t < fim }).length
    meses.push({ label: d.toLocaleDateString('pt-BR', { month: 'short' }), value: count })
  }

  // ── Tempo médio de resposta (30d) ──
  // Para cada par "mensagem do cliente → próxima resposta do agente" na mesma conversa
  let somaSeg = 0, pares = 0
  let atual = '', ultimaUser: number | null = null
  for (const m of mensagens) {
    if (m.conversation_id !== atual) { atual = m.conversation_id; ultimaUser = null }
    const t = new Date(m.created_at).getTime()
    if (m.role === 'user') { ultimaUser = t }
    else if (ultimaUser !== null) {
      const diff = (t - ultimaUser) / 1000
      if (diff >= 0 && diff < 3600) { somaSeg += diff; pares++ } // ignora gaps > 1h (sessão nova)
      ultimaUser = null
    }
  }
  const tempoMedioSeg = pares ? Math.round(somaSeg / pares) : 0
  const tempoMedioTxt = tempoMedioSeg >= 60 ? `${Math.floor(tempoMedioSeg / 60)}m ${tempoMedioSeg % 60}s` : `${tempoMedioSeg}s`

  // ── Agentes mais usados (180d) ──
  const nomeAgente: Record<string, string> = {}
  const empresaDeAgente: Record<string, string> = {}
  ags.forEach((a: any) => { nomeAgente[a.id] = a.name; empresaDeAgente[a.id] = a.profiles?.company_name ?? 'Sem cliente' })
  const porAgente: Record<string, number> = {}
  const porCliente: Record<string, number> = {}
  for (const c of conversas) {
    if (!c.agent_id) continue
    porAgente[c.agent_id] = (porAgente[c.agent_id] ?? 0) + 1
    const emp = empresaDeAgente[c.agent_id] ?? 'Sem cliente'
    porCliente[emp] = (porCliente[emp] ?? 0) + 1
  }
  const topAgentes: Bar[] = Object.entries(porAgente)
    .map(([id, v]) => ({ label: nomeAgente[id] ?? '—', value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 8)
  const topClientes: Bar[] = Object.entries(porCliente)
    .map(([nome, v]) => ({ label: nome, value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 8)

  // ── Termos mais frequentes (30d, mensagens dos clientes) ──
  const freq: Record<string, number> = {}
  for (const m of mensagens) {
    if (m.role !== 'user' || !m.content) continue
    const palavras = String(m.content).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    for (const p of palavras) {
      if (p.length < 4) continue
      if (STOPWORDS.has(p)) continue
      freq[p] = (freq[p] ?? 0) + 1
    }
  }
  const topTermos: Bar[] = Object.entries(freq)
    .map(([t, v]) => ({ label: t, value: v }))
    .sort((a, b) => b.value - a.value).slice(0, 12)

  const cardTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 } as React.CSSProperties

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1040 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Analytics</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Desempenho consolidado de toda a plataforma Bonsync.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Conversas (total)', value: totalConversas ?? 0, color: C.blueB },
          { label: 'Últimos 30 dias', value: convs30Total, color: C.blueB },
          { label: 'Taxa de resolução', value: `${taxaResol}%`, color: taxaResol >= 70 ? C.green : C.yellow },
          { label: 'Taxa de escalonamento', value: `${taxaErro}%`, color: taxaErro <= 20 ? C.green : C.red },
          { label: 'Tempo médio resposta', value: tempoMedioTxt, color: C.blueB },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 26, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Conversas por dia */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <h2 style={cardTitle}>Conversas por dia</h2>
        <p style={{ ...T.sub, fontSize: 12, marginBottom: 8 }}>Últimos 30 dias.</p>
        <BarChart data={porDia} color={C.blueB} height={150} />
      </div>

      {/* Por mês + termos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={CARD}>
          <h2 style={cardTitle}>Conversas por mês</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 8 }}>Últimos 6 meses.</p>
          <BarChart data={meses} color={C.green} height={150} />
        </div>
        <div style={CARD}>
          <h2 style={cardTitle}>Termos mais frequentes</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>Palavras nas mensagens dos clientes (30d).</p>
          <RankBars data={topTermos} color={C.yellow} />
        </div>
      </div>

      {/* Rankings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={CARD}>
          <h2 style={cardTitle}>Agentes mais usados</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>Por nº de conversas (180d).</p>
          <RankBars data={topAgentes} color={C.blueB} />
        </div>
        <div style={CARD}>
          <h2 style={cardTitle}>Clientes mais ativos</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>Por nº de conversas (180d).</p>
          <RankBars data={topClientes} color={C.green} />
        </div>
      </div>
    </div>
  )
}
