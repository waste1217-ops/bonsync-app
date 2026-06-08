import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'
import { BarChart, RankBars, type Bar } from '@/components/BarChart'
import { RelatorioActions } from '@/components/RelatorioActions'

export const dynamic = 'force-dynamic'

const TEMAS = [
  { nome: 'Atendimento via WhatsApp', kw: ['whatsapp', 'atendimento', 'atender', 'contato', 'falar', 'mensagem', 'responder'] },
  { nome: 'Preço e orçamento', kw: ['preço', 'preco', 'valor', 'orçamento', 'orcamento', 'custo', 'quanto', 'custa', 'investimento', 'mensalidade'] },
  { nome: 'Produtos e serviços', kw: ['produto', 'serviço', 'servico', 'catalogo', 'catálogo', 'plano', 'pacote', 'bolo', 'cosmetico'] },
  { nome: 'Prazo e operação', kw: ['prazo', 'entrega', 'operação', 'operacao', 'funciona', 'envio', 'expedição', 'expedicao', 'estoque'] },
  { nome: 'Reunião comercial', kw: ['reunião', 'reuniao', 'call', 'agenda', 'marcar', 'apresentação', 'demonstração', 'demonstracao'] },
  { nome: 'Volume mensal', kw: ['volume', 'pedidos', 'mensal', 'quantidade', 'escala', 'demanda'] },
  { nome: 'Integrações', kw: ['integração', 'integracao', 'integra', 'mercado', 'livre', 'shopee', 'amazon', 'shopify', 'magalu', 'marketplace', 'erp', 'tiny', 'bling'] },
]
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export default async function RelatoriosPage({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string }> }) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user!.id).single()
  const aid = agent?.id ?? ''

  const agora = Date.now()
  const spNow = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const todayStart = new Date(`${spNow}T03:00:00.000Z`).getTime()
  let p = sp.p || '30'
  let fromMs: number, toMs = agora, periodoLabel: string
  if (sp.from && sp.to) { fromMs = new Date(sp.from + 'T03:00:00Z').getTime(); toMs = new Date(sp.to + 'T03:00:00Z').getTime() + 86400000; p = 'custom'; periodoLabel = 'Período personalizado' }
  else if (p === 'hoje') { fromMs = todayStart; periodoLabel = 'Hoje' }
  else if (p === '7') { fromMs = agora - 7 * 86400000; periodoLabel = 'Últimos 7 dias' }
  else if (p === 'mes') { fromMs = new Date(`${spNow.slice(0, 7)}-01T03:00:00.000Z`).getTime(); periodoLabel = 'Este mês' }
  else { p = '30'; fromMs = agora - 30 * 86400000; periodoLabel = 'Últimos 30 dias' }
  const fromIso = new Date(fromMs).toISOString()

  const { data: convs } = await supabase
    .from('conversations').select('id, started_at, status, lead_status, message_count')
    .eq('agent_id', aid).gte('started_at', fromIso).order('started_at', { ascending: false }).limit(3000)
  const conversas = convs ?? []
  const convIds = conversas.map(c => c.id)

  const [{ data: msgs }, { data: deals }] = await Promise.all([
    convIds.length
      ? supabase.from('messages').select('conversation_id, role, content, created_at').in('conversation_id', convIds).order('conversation_id', { ascending: true }).order('created_at', { ascending: true }).limit(8000)
      : Promise.resolve({ data: [] as any[] }),
    supabase.from('deals').select('status, confirmed_at, detected_at, valor').eq('agent_id', aid),
  ])
  const mensagens = msgs ?? []

  // KPIs
  const totalC = conversas.length
  const resolvidas = conversas.filter(c => c.status === 'resolved').length
  const comHumano = conversas.filter(c => c.status === 'escalated').length
  const taxaResol = totalC ? Math.round((resolvidas / totalC) * 100) : 0
  const quentes = conversas.filter(c => c.lead_status === 'qualificado').length
  const mornos = conversas.filter(c => c.lead_status === 'potencial').length
  const vendas = deals?.filter(d => d.status === 'confirmed' && (d.confirmed_at ? new Date(d.confirmed_at).getTime() >= fromMs : true)).length ?? 0
  const taxaConv = totalC ? Math.round((vendas / totalC) * 100) : 0

  // Tempo médio de resposta
  let somaSeg = 0, pares = 0, atual = '', ultUser: number | null = null
  for (const m of mensagens) {
    if (m.conversation_id !== atual) { atual = m.conversation_id; ultUser = null }
    const t = new Date(m.created_at).getTime()
    if (m.role === 'user') ultUser = t
    else if (ultUser !== null) { const d = (t - ultUser) / 1000; if (d >= 0 && d < 3600) { somaSeg += d; pares++ } ultUser = null }
  }
  const tms = pares ? Math.round(somaSeg / pares) : 0
  const tmsTxt = tms >= 60 ? `${Math.floor(tms / 60)}m ${tms % 60}s` : `${tms}s`

  // Conversas por dia
  const diasJanela = Math.min(Math.max(Math.ceil((toMs - fromMs) / 86400000), 1), 31)
  const diaMap: Record<string, number> = {}
  for (let i = diasJanela - 1; i >= 0; i--) diaMap[new Date(agora - i * 86400000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })] = 0
  for (const c of conversas) { const k = new Date(c.started_at).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }); if (k in diaMap) diaMap[k]++ }
  const porDia: Bar[] = Object.keys(diaMap).map((k, i) => ({ label: (diasJanela <= 10 || i % 3 === 0) ? `${k.slice(8)}/${k.slice(5, 7)}` : '', value: diaMap[k] }))
  const poucosDados = totalC < 4

  // Horários
  const horas = new Array(24).fill(0)
  for (const m of mensagens) { if (m.role !== 'user') continue; const h = Number(new Date(m.created_at).toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: '2-digit', hour12: false }).slice(0, 2)) % 24; horas[h]++ }
  const porHora: Bar[] = horas.map((v, h) => ({ label: h % 3 === 0 ? `${h}h` : '', value: v }))
  const picoH = horas.indexOf(Math.max(...horas))
  const periodoDia = picoH < 6 ? 'da madrugada' : picoH < 12 ? 'da manhã' : picoH < 18 ? 'da tarde' : 'da noite'
  const temPico = Math.max(...horas) > 0

  // Assuntos por tema
  const temaCount: Record<string, number> = {}
  for (const m of mensagens) {
    if (m.role !== 'user' || !m.content) continue
    const txt = norm(String(m.content))
    for (const t of TEMAS) if (t.kw.some(k => txt.includes(norm(k)))) temaCount[t.nome] = (temaCount[t.nome] ?? 0) + 1
  }
  const temas: Bar[] = Object.entries(temaCount).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).filter(t => t.value > 0)
  const assuntoPrincipal = temas[0]?.label

  const canalPrincipal = 'WhatsApp'

  // Resumo executivo
  const resumo = `Em ${periodoLabel.toLowerCase()}, o agente realizou ${totalC} ${totalC === 1 ? 'atendimento' : 'atendimentos'}, gerou ${vendas} ${vendas === 1 ? 'venda' : 'vendas'} e manteve uma taxa de conversão de ${taxaConv}%.`
    + (taxaResol < 50
        ? ` O principal ponto de atenção é a taxa de resolução em ${taxaResol}%, indicando que muitos atendimentos ainda dependem da equipe humana.`
        : ` A taxa de resolução está em ${taxaResol}%, um bom indicador de autonomia do agente.`)
    + (assuntoPrincipal ? ` Os clientes perguntaram principalmente sobre ${assuntoPrincipal.toLowerCase()}.` : '')

  // Insights
  const insights: string[] = []
  if (totalC > 0) insights.push(`A taxa de conversão foi de ${taxaConv}%, ou seja, cerca de 1 a cada ${taxaConv > 0 ? Math.max(1, Math.round(100 / taxaConv)) : '—'} conversas virou oportunidade.`)
  insights.push(taxaResol < 50 ? `A taxa de resolução está em ${taxaResol}% — o agente pode precisar de mais base de conhecimento.` : `A taxa de resolução está saudável (${taxaResol}%).`)
  if (temPico) insights.push(`O horário de maior volume foi por volta das ${picoH}h ${periodoDia}.`)
  if (temas.length) insights.push(`Clientes perguntaram bastante sobre ${temas.slice(0, 3).map(t => t.label.toLowerCase()).join(', ')}.`)
  if (conversas.some(c => (c.message_count ?? 0) > 12)) insights.push('Conversas com muitas mensagens podem indicar dúvidas não resolvidas rapidamente.')

  // Recomendações
  const recs: { txt: string; acoes: [string, string][] }[] = [
    { txt: 'Revisar as conversas que foram encaminhadas para humano.', acoes: [['Ver conversas', '/painel/conversas']] },
    { txt: 'Adicionar respostas sobre preço e prazo na base de conhecimento.', acoes: [['Adicionar conhecimento', '/painel/conhecimento']] },
    { txt: 'Acompanhar os leads que tiveram mais mensagens.', acoes: [['Ver leads', '/painel/leads']] },
  ]
  if (taxaResol < 50) recs.unshift({ txt: 'Melhorar a resposta inicial e a base para aumentar a taxa de resolução.', acoes: [['Adicionar conhecimento', '/painel/conhecimento']] })
  if (assuntoPrincipal) recs.push({ txt: `Criar uma campanha focada no assunto mais perguntado (${assuntoPrincipal.toLowerCase()}).`, acoes: [['Ver leads', '/painel/leads']] })

  // Grupos de métricas
  const grupo1 = [
    { t: 'Conversas atendidas', v: totalC, c: C.blueB, d: 'Total de atendimentos realizados pelo agente.' },
    { t: 'Taxa de resolução', v: `${taxaResol}%`, c: taxaResol >= 50 ? C.green : C.yellow, d: 'Atendimentos finalizados sem intervenção humana.' },
    { t: 'Tempo médio de resposta', v: tmsTxt, c: C.blueB, d: 'Velocidade média das respostas do agente.' },
    { t: 'Com humano', v: comHumano, c: C.red, d: 'Conversas encaminhadas para sua equipe.' },
  ]
  const grupo2 = [
    { t: 'Taxa de conversão', v: `${taxaConv}%`, c: C.green, d: 'Conversas que viraram oportunidade.' },
    { t: 'Leads quentes', v: quentes, c: C.green, d: 'Alta intenção de compra.' },
    { t: 'Leads mornos', v: mornos, c: C.yellow, d: 'Interesse real, ainda decidindo.' },
    { t: 'Vendas geradas', v: vendas, c: C.green, d: 'Oportunidades fechadas ou confirmadas.' },
  ]
  const grupo3 = [
    { t: 'Horário de pico', v: temPico ? `${picoH}h` : '—', c: C.yellow, d: 'Horário com mais mensagens recebidas.' },
    { t: 'Assunto principal', v: assuntoPrincipal ? '1º' : '—', c: C.blueB, d: assuntoPrincipal || 'Sem dados suficientes.', big: assuntoPrincipal },
    { t: 'Canal principal', v: canalPrincipal, c: C.blueB, d: 'Origem da maioria das conversas.', small: true },
    { t: 'Conversas no período', v: totalC, c: C.blueB, d: 'Total dentro do filtro selecionado.' },
  ]

  // CSV / e-mail
  const linhas: [string, string][] = [
    ['Período', periodoLabel], ['Conversas atendidas', String(totalC)], ['Taxa de resolução', `${taxaResol}%`],
    ['Tempo médio de resposta', tmsTxt], ['Com humano', String(comHumano)], ['Taxa de conversão', `${taxaConv}%`],
    ['Leads quentes', String(quentes)], ['Leads mornos', String(mornos)], ['Vendas geradas', String(vendas)],
    ['Horário de pico', temPico ? `${picoH}h` : '—'], ['Assunto principal', assuntoPrincipal || '—'],
  ]
  const csv: string[][] = [['Métrica', 'Valor'], ...linhas, [], ['Assuntos', 'Menções'], ...temas.map(t => [t.label, String(t.value)])]

  const card = (m: any) => (
    <div key={m.t} style={CARD}>
      <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 10 }}>{m.t}</p>
      <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: m.small ? 18 : 26, color: m.c, letterSpacing: '-0.02em', lineHeight: 1.05 }}>{m.big || m.v}</p>
      <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 11.5, color: C.muted, marginTop: 8, lineHeight: 1.4 }}>{m.d}</p>
    </div>
  )
  const grupoTitulo = { ...T.mono, color: C.muted, marginBottom: 12 } as React.CSSProperties
  const chartTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 } as React.CSSProperties
  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={T.h1}>Relatórios</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Analise o desempenho do agente, descubra padrões nas conversas e identifique oportunidades de melhoria.</p>
      </div>

      <RelatorioActions mode="top" period={p} periodoLabel={periodoLabel} csv={csv} resumo={resumo} linhas={linhas} />

      {/* Resumo executivo */}
      <div style={{ position: 'relative', overflow: 'hidden', marginBottom: 20, background: 'linear-gradient(135deg, oklch(22% 0.07 230 / 0.5), var(--c-deep))', border: '1px solid oklch(70% 0.16 220 / 0.32)', borderRadius: 16, padding: '20px 22px' }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, oklch(65% 0.2 220/0.16) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'oklch(65% 0.2 220 / 0.16)', border: '1px solid oklch(70% 0.18 220 / 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✦</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ ...T.mono, fontSize: 10, letterSpacing: '0.16em', color: 'oklch(80% 0.12 215)', marginBottom: 8 }}>Resumo executivo · IA</p>
            <p style={{ fontFamily: FONT.dm, fontSize: 15.5, color: C.white, lineHeight: 1.65, fontWeight: 300 }}>{resumo}</p>
          </div>
        </div>
      </div>

      <div className="rl-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.2fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>
        {/* ESQUERDA */}
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <p style={grupoTitulo}>Desempenho do atendimento</p>
            <div className="rl-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>{grupo1.map(card)}</div>
          </div>
          <div>
            <p style={grupoTitulo}>Resultado comercial</p>
            <div className="rl-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>{grupo2.map(card)}</div>
          </div>
          <div>
            <p style={grupoTitulo}>Comportamento dos clientes</p>
            <div className="rl-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>{grupo3.map(card)}</div>
          </div>

          <div style={CARD}>
            <h2 style={chartTitle}>Conversas por dia</h2>
            <p style={{ ...T.sub, fontSize: 12, marginBottom: 8 }}>Evolução dos atendimentos no período selecionado.</p>
            <BarChart data={porDia} color={C.blueB} height={150} />
            {poucosDados && <p style={{ ...T.sub, fontSize: 12, marginTop: 10 }}>Ainda há poucos dados para identificar tendência, mas os atendimentos recentes já aparecem no gráfico.</p>}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="rl-charts">
            <div style={CARD}>
              <h2 style={chartTitle}>Horários de maior movimento</h2>
              <p style={{ ...T.sub, fontSize: 12, marginBottom: 4 }}>Veja em quais horários os clientes mais chamam.</p>
              {temPico && <p style={{ fontFamily: FONT.jb, fontSize: 11, color: 'oklch(80% 0.16 215)', marginBottom: 8 }}>Pico atual: {picoH}h {periodoDia}</p>}
              <BarChart data={porHora} color={C.yellow} height={140} />
            </div>
            <div style={CARD}>
              <h2 style={chartTitle}>Assuntos mais perguntados</h2>
              <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>Temas identificados nas mensagens dos clientes.</p>
              <RankBars data={temas} color={C.green} suffix=" menções" />
            </div>
          </div>
        </div>

        {/* DIREITA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <div style={CARD}>
            <h2 style={sideTitle}>Resumo do período</h2>
            {[[`Período: ${periodoLabel}`, C.muted], [`Conversas: ${totalC}`, 'var(--c-blue-b)'], [`Conversão: ${taxaConv}%`, 'var(--c-green)'], [`Vendas: ${vendas}`, 'var(--c-green)'], [`Ponto de atenção: ${taxaResol < 50 ? 'resolução baixa' : 'sem alertas'}`, taxaResol < 50 ? 'var(--c-yellow)' : 'var(--c-muted)']].map(([t, c], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c as string, flexShrink: 0 }} />
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300 }}>{t}</span>
              </div>
            ))}
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Insights da IA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {insights.map((ins, i) => <div key={i} style={{ display: 'flex', gap: 9 }}><span style={{ color: 'oklch(80% 0.16 215)', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>✦</span><span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.5 }}>{ins}</span></div>)}
            </div>
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Recomendações</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {recs.map((r, i) => (
                <div key={i}>
                  <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, fontWeight: 300, lineHeight: 1.5 }}>{r.txt}</p>
                  <div style={{ display: 'flex', gap: 10, marginTop: 5 }}>
                    {r.acoes.map(([l, h]) => <a key={l} href={h} style={{ fontFamily: FONT.jb, fontSize: 10, color: C.blueB }}>{l} →</a>)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={CARD}>
            <h2 style={sideTitle}>Ações rápidas</h2>
            <RelatorioActions mode="side" period={p} periodoLabel={periodoLabel} csv={csv} resumo={resumo} linhas={linhas} />
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1040px){ .rl-grid{ grid-template-columns: 1fr !important; } }
        @media (max-width: 760px){ .rl-cards{ grid-template-columns: repeat(2,1fr) !important; } .rl-charts{ grid-template-columns: 1fr !important; } }
        @media print { .rel-noprint{ display:none !important; } aside{ display:none !important; } }
      `}</style>
    </div>
  )
}
