import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'
import { BarChart, RankBars, type Bar } from '@/components/BarChart'

export const dynamic = 'force-dynamic'

const STOPWORDS = new Set(['a','o','e','é','de','do','da','que','em','um','uma','para','com','não','nao','os','as','no','na','se','por','mais','dos','das','ao','à','aos','às','meu','minha','seu','sua','isso','isto','esse','essa','este','esta','como','mas','ou','já','ja','eu','você','voce','vc','me','te','lhe','nos','ele','ela','foi','ser','está','esta','estou','tem','ter','vai','quero','queria','pode','poderia','sim','bom','boa','dia','tarde','noite','oi','olá','ola','obrigado','obrigada','favor','aqui','tudo','bem','então','entao','pra','pro','até','ate','sobre','quanto','qual','quais','onde','quando','sou','the'])

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user!.id).single()
  const agentId = agent?.id ?? ''

  const agora = Date.now()
  const d30 = new Date(agora - 30 * 86400000).toISOString()
  const d180 = new Date(agora - 180 * 86400000).toISOString()

  const { data: convs } = await supabase
    .from('conversations').select('id, started_at, status, lead_status')
    .eq('agent_id', agentId).gte('started_at', d180).limit(6000)
  const conversas = convs ?? []
  const convIds = conversas.map(c => c.id)

  const [{ data: msgs }, { data: deals }] = await Promise.all([
    convIds.length
      ? supabase.from('messages').select('conversation_id, role, content, created_at')
          .in('conversation_id', convIds).gte('created_at', d30)
          .order('conversation_id', { ascending: true }).order('created_at', { ascending: true }).limit(10000)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('deals').select('status').eq('agent_id', agentId),
  ])
  const mensagens = msgs ?? []

  const total = conversas.length
  const resolvidas = conversas.filter(c => c.status === 'resolved').length
  const escaladas  = conversas.filter(c => c.status === 'escalated').length
  const taxaResol = total ? Math.round((resolvidas / total) * 100) : 0
  const vendas = deals?.filter(d => d.status === 'confirmed').length ?? 0
  const taxaConv = total ? Math.round((vendas / total) * 100) : 0

  const qualificados = conversas.filter(c => c.lead_status === 'qualificado').length
  const potenciais   = conversas.filter(c => c.lead_status === 'potencial').length
  const curiosos     = conversas.filter(c => c.lead_status === 'curioso').length

  // Atendimentos por dia (30d)
  const diaMap: Record<string, number> = {}
  for (let i = 29; i >= 0; i--) diaMap[new Date(agora - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })] = 0
  for (const c of conversas) { const k = new Date(c.started_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); if (k in diaMap) diaMap[k]++ }
  const convs30 = Object.values(diaMap).reduce((a, b) => a + b, 0)
  const porDia: Bar[] = Object.keys(diaMap).map((k, i) => ({ label: i % 3 === 0 ? `${k.slice(8)}/${k.slice(5, 7)}` : '', value: diaMap[k] }))

  // Horários de pico (mensagens dos clientes, por hora BRT)
  const horas = new Array(24).fill(0)
  for (const m of mensagens) {
    if (m.role !== 'user') continue
    const h = Number(new Date(m.created_at).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).slice(0, 2)) % 24
    horas[h]++
  }
  const porHora: Bar[] = horas.map((v, h) => ({ label: h % 3 === 0 ? `${h}h` : '', value: v }))

  // Tempo médio de resposta (pares cliente→agente, 30d)
  let somaSeg = 0, pares = 0, atual = '', ultimaUser: number | null = null
  for (const m of mensagens) {
    if (m.conversation_id !== atual) { atual = m.conversation_id; ultimaUser = null }
    const t = new Date(m.created_at).getTime()
    if (m.role === 'user') ultimaUser = t
    else if (ultimaUser !== null) { const d = (t - ultimaUser) / 1000; if (d >= 0 && d < 3600) { somaSeg += d; pares++ } ultimaUser = null }
  }
  const tms = pares ? Math.round(somaSeg / pares) : 0
  const tmsTxt = tms >= 60 ? `${Math.floor(tms / 60)}m ${tms % 60}s` : `${tms}s`

  // Assuntos mais perguntados (mensagens dos clientes, 30d)
  const freq: Record<string, number> = {}
  for (const m of mensagens) {
    if (m.role !== 'user' || !m.content) continue
    for (const p of String(m.content).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
      if (p.length < 4 || STOPWORDS.has(p)) continue
      freq[p] = (freq[p] ?? 0) + 1
    }
  }
  const topTermos: Bar[] = Object.entries(freq).map(([t, v]) => ({ label: t, value: v })).sort((a, b) => b.value - a.value).slice(0, 10)

  const titulo = { fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 } as React.CSSProperties

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={T.h1}>Relatórios</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Como seu agente vem performando — atendimentos, horários, assuntos e conversões.</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Atendimentos', value: total, color: C.blueB },
          { label: 'Últimos 30 dias', value: convs30, color: C.blueB },
          { label: 'Taxa de resolução', value: `${taxaResol}%`, color: taxaResol >= 70 ? C.green : C.yellow },
          { label: 'Taxa de conversão', value: `${taxaConv}%`, color: C.green },
          { label: 'Tempo médio resposta', value: tmsTxt, color: C.blueB },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 24, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Leads + conversões */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Leads qualificados', value: qualificados, color: C.green },
          { label: 'Leads potenciais', value: potenciais, color: C.yellow },
          { label: 'Curiosos', value: curiosos, color: C.muted },
          { label: 'Vendas / p/ humano', value: `${vendas} / ${escaladas}`, color: C.blueB },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 22, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Atendimentos por dia */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <h2 style={titulo}>Atendimentos por dia</h2>
        <p style={{ ...T.sub, fontSize: 12, marginBottom: 8 }}>Últimos 30 dias.</p>
        <BarChart data={porDia} color={C.blueB} height={150} />
      </div>

      {/* Pico + assuntos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={CARD}>
          <h2 style={titulo}>Horários de pico</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 8 }}>Quando seus clientes mais escrevem (30d).</p>
          <BarChart data={porHora} color={C.yellow} height={150} />
        </div>
        <div style={CARD}>
          <h2 style={titulo}>Assuntos mais perguntados</h2>
          <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>Termos mais usados pelos clientes (30d).</p>
          <RankBars data={topTermos} color={C.green} />
        </div>
      </div>
    </div>
  )
}
