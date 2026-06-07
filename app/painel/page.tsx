import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'

const S = {
  h1:   { fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 } as React.CSSProperties,
  sub:  { fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' } as React.CSSProperties,
  mono: { fontFamily: 'var(--font-jb)', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

const STOPWORDS = new Set(['a','o','e','é','de','do','da','que','em','um','uma','para','com','não','nao','os','as','no','na','se','por','mais','dos','das','ao','meu','minha','seu','sua','isso','isto','esse','essa','este','esta','como','mas','ou','já','ja','eu','você','voce','vc','me','te','nos','ele','ela','foi','ser','está','esta','estou','tem','ter','vai','quero','queria','pode','sim','bom','boa','dia','tarde','noite','oi','olá','ola','obrigado','obrigada','favor','aqui','tudo','bem','então','entao','pra','pro','até','ate','sobre','quanto','qual','quais','onde','quando','sou','the'])

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}

export const dynamic = 'force-dynamic'

export default async function PainelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: agent } = await supabase.from('agents').select('*').eq('client_id', user!.id).single()

  if (!agent) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ ...S.h1, fontSize: 20 }}>Nenhum agente configurado</p>
        <p style={S.sub}>Entre em contato com a Bonsync para configurar seu agente.</p>
      </div>
    </div>
  )

  const aid = agent.id
  const nowSp = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const inicioHoje = `${nowSp}T03:00:00.000Z`
  const inicioMes  = `${nowSp.slice(0, 7)}-01T03:00:00.000Z`
  const d30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const [
    { count: total }, { count: resolved }, { count: escalated },
    { count: convHoje }, { count: convMes },
    { data: deals }, { data: leadRows }, { data: recentes }, { data: convIds30 },
  ] = await Promise.all([
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', aid),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', aid).eq('status', 'resolved'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', aid).eq('status', 'escalated'),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', aid).gte('started_at', inicioHoje),
    supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', aid).gte('started_at', inicioMes),
    supabase.from('deals').select('status, detected_at').eq('agent_id', aid),
    supabase.from('conversations').select('lead_status, lead_updated_at').eq('agent_id', aid),
    supabase.from('conversations').select('*').eq('agent_id', aid).order('started_at', { ascending: false }).limit(5),
    supabase.from('conversations').select('id').eq('agent_id', aid).gte('started_at', d30).limit(400),
  ])

  // Negócios / vendas
  const vendas = deals?.filter(d => d.status === 'confirmed').length ?? 0
  const vendasMes = deals?.filter(d => d.status === 'confirmed' && d.detected_at && d.detected_at >= inicioMes).length ?? 0
  const pendentes = deals?.filter(d => d.status === 'pending').length ?? 0
  const taxaConv = (total ?? 0) ? Math.round((vendas / (total ?? 1)) * 100) : 0

  // Leads (classificação por IA)
  const quentes = leadRows?.filter(l => l.lead_status === 'qualificado').length ?? 0
  const mornos  = leadRows?.filter(l => l.lead_status === 'potencial').length ?? 0
  const curiosos = leadRows?.filter(l => l.lead_status === 'curioso').length ?? 0
  const leadsCaptados = quentes + mornos
  const leadsMes = leadRows?.filter(l => l.lead_status === 'qualificado' && l.lead_updated_at && l.lead_updated_at >= inicioMes).length ?? 0
  const abertas = (total ?? 0) - (resolved ?? 0) - (escalated ?? 0)

  // Assuntos mais perguntados (para Insights)
  let topTermos: string[] = []
  const ids = (convIds30 ?? []).map(c => c.id)
  if (ids.length) {
    const { data: msgs } = await supabase.from('messages').select('content, role').in('conversation_id', ids).eq('role', 'user').limit(800)
    const freq: Record<string, number> = {}
    for (const m of msgs ?? []) {
      for (const p of String(m.content || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
        if (p.length < 4 || STOPWORDS.has(p)) continue
        freq[p] = (freq[p] ?? 0) + 1
      }
    }
    topTermos = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)
  }

  // ── Resumo de hoje ──
  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`
  const statusFrase = agent.status === 'active'
    ? 'Seu agente está ativo e monitorando o WhatsApp.'
    : agent.status === 'paused'
      ? 'Seu agente está pausado — ative em Status para voltar a atender.'
      : 'Seu agente está com um erro e foi pausado. Fale com a Bonsync.'
  const hojeFrase = (convHoje ?? 0) === 0
    ? (abertas > 0 ? `Até agora foram 0 conversas hoje, mas existem ${plural(abertas, 'atendimento em aberto', 'atendimentos em aberto')} que precisam de atenção.`
                   : 'Ainda não houve conversas hoje — assim que alguém chamar, o agente responde na hora.')
    : `Hoje já foram ${plural(convHoje ?? 0, 'conversa', 'conversas')}` + (abertas > 0 ? `, e ${plural(abertas, 'atendimento segue em aberto', 'atendimentos seguem em aberto')} aguardando atenção.` : '.')
  const mesFrase = (convMes ?? 0) > 0
    ? `No mês, o agente já realizou ${plural(convMes ?? 0, 'conversa', 'conversas')}, captou ${plural(leadsMes, 'lead', 'leads')} e gerou ${plural(vendasMes, 'venda', 'vendas')}.`
    : 'Este mês ainda está começando — os resultados aparecem aqui conforme as conversas acontecem.'
  const linhasResumo = [statusFrase, hojeFrase, mesFrase]

  const stLabel: Record<string, string> = { active: 'Ativo', paused: 'Pausado', error: 'Erro' }
  const stCor: Record<string, string> = { active: 'var(--c-green)', paused: 'var(--c-yellow)', error: 'var(--c-red)' }
  const miniIndicadores = [
    { label: 'Hoje', value: `${convHoje ?? 0} ${(convHoje ?? 0) === 1 ? 'conversa' : 'conversas'}`, color: 'var(--c-white)' },
    { label: 'Em aberto', value: String(abertas), color: abertas > 0 ? 'var(--c-yellow)' : 'var(--c-white)' },
    { label: 'Status', value: stLabel[agent.status] ?? agent.status, color: stCor[agent.status] ?? 'var(--c-white)' },
  ]

  // ── Métricas principais (ordem comercial, 3 por linha) ──
  const ciano = 'var(--c-blue-b)'
  const metricas = [
    { t: 'Leads captados', v: leadsCaptados, d: 'Contatos com potencial comercial identificados pela IA.', c: ciano },
    { t: 'Vendas geradas', v: vendas, d: 'Oportunidades fechadas ou confirmadas.', c: 'var(--c-green)' },
    { t: 'Taxa de conversão', v: `${taxaConv}%`, d: 'Conversas que viraram oportunidade.', c: 'var(--c-green)' },
    { t: 'Conversas hoje', v: convHoje ?? 0, d: 'Atendimentos iniciados hoje.', c: ciano },
    { t: 'Conversas no mês', v: convMes ?? 0, d: 'Atendimentos iniciados no mês.', c: ciano },
    { t: 'Em aberto', v: abertas, d: 'Conversas ainda em andamento.', c: abertas > 0 ? 'var(--c-yellow)' : 'var(--c-white)' },
    { t: 'Com humano', v: escalated ?? 0, d: 'Atendimentos passados para uma pessoa.', c: 'var(--c-white)' },
    { t: 'Leads quentes', v: quentes, d: 'Alta intenção de compra.', c: 'var(--c-green)' },
    { t: 'Leads mornos', v: mornos, d: 'Interesse real, ainda decidindo.', c: 'var(--c-yellow)' },
    { t: 'Apenas pesquisando', v: curiosos, d: 'Sem intenção clara de compra.', c: 'var(--c-muted)' },
  ]

  // ── Atenção necessária ──
  const atencao: { txt: string; cor: string; href: string }[] = []
  if (abertas > 0) atencao.push({ txt: `${plural(abertas, 'conversa está em aberto', 'conversas estão em aberto')}`, cor: 'var(--c-yellow)', href: '/painel/conversas' })
  if ((escalated ?? 0) > 0) atencao.push({ txt: `${plural(escalated ?? 0, 'conversa foi passada', 'conversas foram passadas')} para humano`, cor: 'var(--c-yellow)', href: '/painel/conversas' })
  if (pendentes > 0) atencao.push({ txt: `${plural(pendentes, 'venda precisa', 'vendas precisam')} de confirmação`, cor: ciano, href: '/painel/negocios' })
  atencao.push(agent.status === 'active'
    ? { txt: 'Agente ativo no WhatsApp', cor: 'var(--c-green)', href: '/painel/status' }
    : agent.status === 'paused'
      ? { txt: 'Agente pausado', cor: 'var(--c-yellow)', href: '/painel/status' }
      : { txt: 'Agente com erro', cor: 'var(--c-red)', href: '/painel/status' })

  // ── Insights da IA ──
  const insights: string[] = []
  if (topTermos[0]) insights.push(`O principal interesse dos clientes foi sobre "${topTermos[0]}".`)
  if (quentes > 0) insights.push(`${plural(quentes, 'conversa demonstrou', 'conversas demonstraram')} intenção real de compra.`)
  if (mornos > 0) insights.push(`${plural(mornos, 'contato com interesse', 'contatos com interesse')} para acompanhar de perto.`)
  if (topTermos.length >= 2) insights.push(`Clientes perguntaram sobre ${topTermos.join(', ')}.`)
  if (!insights.length) insights.push('Ainda coletando dados — os insights aparecem após algumas conversas.')

  // ── Próximas ações ──
  const acoes = [
    { txt: 'Ver conversas em aberto', href: '/painel/conversas' },
    { txt: 'Revisar leads', href: '/painel/leads' },
    { txt: 'Confirmar venda', href: '/painel/negocios' },
    { txt: 'Testar agente', href: '/painel/assistente' },
    { txt: 'Ver relatório', href: '/painel/metricas' },
  ]

  const ultimaAtividade = recentes?.[0]?.started_at ?? agent.updated_at ?? agent.created_at
  const convLabel: Record<string, string> = { open: 'Em aberto', resolved: 'Resolvido', escalated: 'Com humano' }
  const convCor: Record<string, string> = { open: 'var(--c-yellow)', resolved: 'var(--c-green)', escalated: 'var(--c-red)' }

  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={S.h1}>Visão geral</h1>
        <p style={S.sub}>Acompanhe em tempo real o desempenho do seu agente, leads captados e oportunidades geradas.</p>
      </div>

      <div className="vg-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2.1fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>

        {/* ───────── COLUNA ESQUERDA ───────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>

          {/* Resumo de hoje */}
          <div style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, oklch(22% 0.07 230 / 0.55), var(--c-deep))', border: '1px solid oklch(70% 0.16 220 / 0.35)', borderRadius: 16, padding: '20px 22px', boxShadow: '0 8px 30px oklch(50% 0.2 230 / 0.12)' }}>
            <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, oklch(65% 0.2 220/0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: 'oklch(65% 0.2 220 / 0.16)', border: '1px solid oklch(70% 0.18 220 / 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="oklch(80% 0.16 215)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...S.mono, fontSize: 10, letterSpacing: '0.16em', color: 'oklch(80% 0.12 215)', marginBottom: 10 }}>Resumo de hoje</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {linhasResumo.map((l, i) => (
                    <p key={i} style={{ fontFamily: 'var(--font-dm)', fontSize: i === 0 ? 15 : 14.5, color: i === 0 ? 'var(--c-white)' : 'var(--c-muted)', lineHeight: 1.55, fontWeight: 300 }}>{l}</p>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                  {miniIndicadores.map(m => (
                    <div key={m.label} style={{ background: 'oklch(28% 0.05 230 / 0.4)', border: '1px solid oklch(70% 0.16 220 / 0.2)', borderRadius: 10, padding: '8px 14px' }}>
                      <span style={{ ...S.mono, fontSize: 8, color: 'var(--c-faint)' }}>{m.label}</span>
                      <p style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 15, color: m.color, lineHeight: 1.1, marginTop: 3 }}>{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Métricas principais */}
          <div>
            <p style={{ ...S.mono, color: 'var(--c-muted)', marginBottom: 12 }}>Métricas principais</p>
            <div className="vg-metrics" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {metricas.map(m => (
                <div key={m.t} style={CARD}>
                  <p style={{ ...S.mono, color: 'var(--c-muted)', marginBottom: 10 }}>{m.t}</p>
                  <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 30, color: m.c, letterSpacing: '-0.03em', lineHeight: 1 }}>{m.v}</p>
                  <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 12, color: 'var(--c-muted)', marginTop: 8, lineHeight: 1.45 }}>{m.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Conversas recentes */}
          <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 15, color: 'var(--c-white)' }}>Conversas recentes</h2>
              <a href="/painel/conversas" style={{ ...S.mono, color: 'var(--c-blue-b)', fontSize: 10 }}>Ver todas →</a>
            </div>
            {!recentes?.length && (
              <div style={{ padding: '40px 22px', textAlign: 'center', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>Nenhuma conversa registrada ainda.</div>
            )}
            {recentes?.map(c => (
              <a key={c.id} href={`/painel/conversas/${c.id}`} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14, cursor: 'pointer' }}>
                <span style={{ fontFamily: 'var(--font-dm)', fontWeight: 500, fontSize: 14, color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{formatContact(c.contact_identifier)}</span>
                <span style={{ fontFamily: 'var(--font-jb)', fontSize: 10, color: convCor[c.status] }}>{convLabel[c.status] ?? c.status}</span>
                <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-faint)', textAlign: 'right' }}>{new Date(c.started_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' })}</span>
              </a>
            ))}
          </div>
        </div>

        {/* ───────── COLUNA DIREITA ───────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Status do agente */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={sideTitle}>Status do agente</h2>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...S.mono, fontSize: 9, color: stCor[agent.status], padding: '4px 10px', borderRadius: 100, background: `color-mix(in oklch, ${stCor[agent.status]} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${stCor[agent.status]} 30%, transparent)` }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: stCor[agent.status] }} className={agent.status === 'active' ? 'animate-pulse-dot' : ''} />
                {stLabel[agent.status]}
              </span>
            </div>
            {[
              ['Nome', agent.name],
              ['Canal', (agent.config?.channels ?? ['WhatsApp']).join(', ')],
              ['Modo', agent.status === 'active' ? 'Respondendo automaticamente' : 'Pausado'],
              ['Última atividade', new Date(ultimaAtividade).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--c-border)' }}>
                <span style={{ ...S.mono, fontSize: 9, color: 'var(--c-faint)' }}>{k}</span>
                <span style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--c-white)', textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <a href="/painel/agente" className="btn-primary" style={{ fontSize: 12, padding: '8px 14px', flex: 1, textAlign: 'center' }}>Ver agente</a>
              <a href="/painel/assistente" className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px', flex: 1, textAlign: 'center' }}>Testar agente</a>
            </div>
          </div>

          {/* Atenção necessária */}
          <div style={CARD}>
            <h2 style={sideTitle}>Atenção necessária</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {atencao.map((a, i) => (
                <a key={i} href={a.href} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: a.cor, flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--c-muted)', fontWeight: 300 }}>{a.txt}</span>
                </a>
              ))}
            </div>
          </div>

          {/* Insights da IA */}
          <div style={CARD}>
            <h2 style={sideTitle}>Insights da IA</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {insights.map((ins, i) => (
                <div key={i} style={{ display: 'flex', gap: 9 }}>
                  <span style={{ color: 'oklch(80% 0.16 215)', fontSize: 12, lineHeight: 1.5, flexShrink: 0 }}>✦</span>
                  <span style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--c-muted)', fontWeight: 300, lineHeight: 1.5 }}>{ins}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Próximas ações */}
          <div style={CARD}>
            <h2 style={sideTitle}>Próximas ações</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {acoes.map(a => (
                <a key={a.href + a.txt} href={a.href} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>
                  {a.txt}
                  <span style={{ color: 'var(--c-faint)' }}>→</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .vg-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 620px) {
          .vg-metrics { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  )
}
