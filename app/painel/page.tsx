import { createClient } from '@/lib/supabase/server'

const S = {
  h1:   { fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 } as React.CSSProperties,
  sub:  { fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' } as React.CSSProperties,
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

export default async function PainelPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: agent } = await supabase
    .from('agents').select('*').eq('client_id', user!.id).single()

  const { count: total } = await supabase
    .from('conversations').select('*', { count: 'exact', head: true }).eq('agent_id', agent?.id ?? '')

  const { count: resolved } = await supabase
    .from('conversations').select('*', { count: 'exact', head: true })
    .eq('agent_id', agent?.id ?? '').eq('status', 'resolved')

  const { count: escalated } = await supabase
    .from('conversations').select('*', { count: 'exact', head: true })
    .eq('agent_id', agent?.id ?? '').eq('status', 'escalated')

  // Janelas de tempo em horário de Brasília
  const nowSp = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD
  const inicioHoje = `${nowSp}T03:00:00.000Z`              // 00:00 BRT = 03:00 UTC
  const inicioMes  = `${nowSp.slice(0, 7)}-01T03:00:00.000Z`

  const { count: convHoje } = await supabase
    .from('conversations').select('*', { count: 'exact', head: true })
    .eq('agent_id', agent?.id ?? '').gte('started_at', inicioHoje)
  const { count: convMes } = await supabase
    .from('conversations').select('*', { count: 'exact', head: true })
    .eq('agent_id', agent?.id ?? '').gte('started_at', inicioMes)

  const { data: deals } = await supabase
    .from('deals').select('status, detected_at').eq('agent_id', agent?.id ?? '')
  const leads  = deals?.length ?? 0
  const vendas = deals?.filter(d => d.status === 'confirmed').length ?? 0
  const taxaConv = total ? Math.round((vendas / total) * 100) : 0
  // Leads classificados pela IA
  const { data: leadRows } = await supabase
    .from('conversations').select('lead_status, lead_updated_at')
    .eq('agent_id', agent?.id ?? '')
  const qualificados = leadRows?.filter(l => l.lead_status === 'qualificado').length ?? 0
  const potenciais   = leadRows?.filter(l => l.lead_status === 'potencial').length ?? 0
  const curiosos     = leadRows?.filter(l => l.lead_status === 'curioso').length ?? 0

  // ── Resumo de hoje (texto dinâmico, comercial) ──
  const abertasGeral = (total ?? 0) - (resolved ?? 0) - (escalated ?? 0)
  const leadsMes  = leadRows?.filter(l => l.lead_status === 'qualificado' && l.lead_updated_at && l.lead_updated_at >= inicioMes).length ?? 0
  const vendasMes = deals?.filter(d => d.status === 'confirmed' && d.detected_at && d.detected_at >= inicioMes).length ?? 0
  const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

  const statusFrase = agent.status === 'active'
    ? 'Seu agente está ativo e monitorando o WhatsApp.'
    : agent.status === 'paused'
      ? 'Seu agente está pausado no momento — ative em Status para voltar a atender.'
      : 'Seu agente está com um erro e foi pausado. Fale com a Bonsync.'

  const hojeFrase = (convHoje ?? 0) === 0
    ? (abertasGeral > 0
        ? `Até agora foram 0 conversas hoje, mas existem ${plural(abertasGeral, 'atendimento em aberto', 'atendimentos em aberto')} que precisam de atenção.`
        : 'Ainda não houve conversas hoje — assim que alguém chamar, o agente responde na hora.')
    : `Hoje já foram ${plural(convHoje ?? 0, 'conversa', 'conversas')}` +
        (abertasGeral > 0 ? `, e ${plural(abertasGeral, 'atendimento segue em aberto', 'atendimentos seguem em aberto')} aguardando atenção.` : '.')

  const mesFrase = (convMes ?? 0) > 0
    ? `No mês, o agente já realizou ${plural(convMes ?? 0, 'conversa', 'conversas')}, captou ${plural(leadsMes, 'lead', 'leads')} e gerou ${plural(vendasMes, 'venda', 'vendas')}.`
    : 'Este mês ainda está começando — os resultados aparecem aqui conforme as conversas acontecem.'

  const linhasResumo = [statusFrase, hojeFrase, mesFrase]

  const statusLabelCurto: Record<string, string> = { active: 'Ativo', paused: 'Pausado', error: 'Erro' }
  const statusCor: Record<string, string> = { active: 'var(--c-green)', paused: 'var(--c-yellow)', error: 'var(--c-red)' }
  const miniIndicadores = [
    { label: 'Hoje', value: `${convHoje ?? 0} ${(convHoje ?? 0) === 1 ? 'conversa' : 'conversas'}`, color: 'var(--c-white)' },
    { label: 'Em aberto', value: String(abertasGeral), color: abertasGeral > 0 ? 'var(--c-yellow)' : 'var(--c-white)' },
    { label: 'Status', value: statusLabelCurto[agent.status] ?? agent.status, color: statusCor[agent.status] ?? 'var(--c-white)' },
  ]

  const { data: recentes } = await supabase
    .from('conversations').select('*')
    .eq('agent_id', agent?.id ?? '')
    .order('started_at', { ascending: false }).limit(6)

  const statusStyle: Record<string, React.CSSProperties> = {
    active:  { color: 'var(--c-green)',  background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.2)' },
    paused:  { color: 'var(--c-yellow)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' },
    error:   { color: 'var(--c-red)',    background: 'rgba(232,64,64,0.1)',   border: '1px solid rgba(232,64,64,0.2)' },
  }
  const convStyle: Record<string, React.CSSProperties> = {
    open:     { color: 'var(--c-yellow)' },
    resolved: { color: 'var(--c-green)' },
    escalated:{ color: 'var(--c-red)' },
  }
  const convLabel: Record<string, string> = { open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado' }
  const agentLabel: Record<string, string> = { active: 'Ativo', paused: 'Pausado', error: 'Erro' }

  if (!agent) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ textAlign: 'center' }}>
        <p style={{ ...S.h1, fontSize: 20 }}>Nenhum agente configurado</p>
        <p style={S.sub}>Entre em contato com a Bonsync para configurar seu agente.</p>
      </div>
    </div>
  )

  return (
    <div className="animate-slide-up" style={{ maxWidth: 960 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={S.h1}>Visão geral</h1>
        <p style={S.sub}>Acompanhe em tempo real o desempenho do seu agente, leads captados e oportunidades geradas.</p>
      </div>

      {/* Resumo de hoje — card premium */}
      <div style={{
        position: 'relative', overflow: 'hidden', marginBottom: 24,
        background: 'linear-gradient(135deg, oklch(22% 0.07 230 / 0.55), var(--c-deep))',
        border: '1px solid oklch(70% 0.16 220 / 0.35)',
        borderRadius: 16, padding: '20px 22px',
        boxShadow: '0 0 0 1px oklch(70% 0.16 220 / 0.05), 0 8px 30px oklch(50% 0.2 230 / 0.12)',
      }}>
        <div style={{ position: 'absolute', right: -40, top: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, oklch(65% 0.2 220/0.18) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: 'oklch(65% 0.2 220 / 0.16)', border: '1px solid oklch(70% 0.18 220 / 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="oklch(80% 0.16 215)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'oklch(80% 0.12 215)', marginBottom: 10 }}>
              Resumo de hoje
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {linhasResumo.map((linha, i) => (
                <p key={i} style={{ fontFamily: 'var(--font-dm)', fontSize: i === 0 ? 15 : 14.5, color: i === 0 ? 'var(--c-white)' : 'var(--c-muted)', lineHeight: 1.55, fontWeight: 300 }}>
                  {linha}
                </p>
              ))}
            </div>

            {/* Mini indicadores */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
              {miniIndicadores.map(m => (
                <div key={m.label} style={{ background: 'oklch(28% 0.05 230 / 0.4)', border: '1px solid oklch(70% 0.16 220 / 0.2)', borderRadius: 10, padding: '8px 14px' }}>
                  <span style={{ fontFamily: 'var(--font-jb)', fontSize: 8, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--c-faint)' }}>{m.label}</span>
                  <p style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 15, color: m.color, lineHeight: 1.1, marginTop: 3 }}>{m.value}</p>
                </div>
              ))}
            </div>

            {abertasGeral > 0 && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 14 }}>
                <a href="/painel/conversas" className="btn-ghost" style={{ fontSize: 12, padding: '8px 16px' }}>Conversas em aberto</a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Agent status card */}
      <div className="card-hi" style={{ marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle at top right, oklch(55% 0.24 225/0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ ...S.mono, color: 'var(--c-muted)', marginBottom: 8 }}>Seu agente</p>
            <h2 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 22, color: 'var(--c-white)', letterSpacing: '-0.02em', marginBottom: 10 }}>
              {agent.name}
            </h2>
            {agent.description && (
              <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)', maxWidth: 480, lineHeight: 1.6 }}>
                {agent.description}
              </p>
            )}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            fontFamily: 'var(--font-jb)', fontSize: 11, letterSpacing: '0.08em',
            padding: '7px 14px', borderRadius: 100,
            ...statusStyle[agent.status]
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: agent.status === 'active' ? 'var(--c-green)' : agent.status === 'paused' ? 'var(--c-yellow)' : 'var(--c-red)' }}
              className={agent.status === 'active' ? 'animate-pulse-dot' : ''} />
            {agentLabel[agent.status]}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Conversas hoje', value: convHoje ?? 0 },
          { label: 'Conversas no mês', value: convMes ?? 0 },
          { label: 'Total de conversas', value: total ?? 0 },
          { label: 'Leads captados', value: leads },
          { label: 'Vendas geradas', value: vendas },
          { label: 'Taxa de conversão', value: `${taxaConv}%` },
          { label: 'Taxa de resolução', value: total ? `${Math.round(((resolved ?? 0) / total) * 100)}%` : '—' },
          { label: 'Escaladas', value: escalated ?? 0 },
          { label: 'Em aberto', value: (total ?? 0) - (resolved ?? 0) - (escalated ?? 0) },
        ].map(s => (
          <div key={s.label} className="card">
            <p style={{ ...S.mono, color: 'var(--c-muted)', marginBottom: 12 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 36, color: 'var(--c-blue-b)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Termômetro de leads */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Leads qualificados', value: qualificados, color: 'var(--c-green)',  help: 'Alta intenção — atenda agora' },
          { label: 'Leads potenciais',   value: potenciais,   color: 'var(--c-yellow)', help: 'Interesse real, acompanhe' },
          { label: 'Curiosos',           value: curiosos,     color: 'var(--c-muted)',  help: 'Só pesquisando' },
        ].map(s => (
          <a key={s.label} href="/painel/leads" className="card" style={{ display: 'block', cursor: 'pointer' }}>
            <p style={{ ...S.mono, color: 'var(--c-muted)', fontSize: 9, marginBottom: 10 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 32, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
            <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 12, color: 'var(--c-muted)', marginTop: 8 }}>{s.help}</p>
          </a>
        ))}
      </div>

      {qualificados > 0 && (
        <a href="/painel/leads" style={{ display: 'block', textDecoration: 'none', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <p style={{ fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-white)' }}>
            🔥 Você tem <b>{qualificados} lead{qualificados > 1 ? 's' : ''} qualificado{qualificados > 1 ? 's' : ''}</b> aguardando — clique para ver e priorizar o atendimento.
          </p>
        </a>
      )}

      {/* Recent conversations */}
      <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 16, color: 'var(--c-white)' }}>
            Conversas recentes
          </h2>
          <a href="/painel/conversas" style={{ ...S.mono, color: 'var(--c-blue-b)', fontSize: 10 }}>
            Ver todas →
          </a>
        </div>
        {/* Col headers */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid rgba(80,130,210,0.08)' }}>
          {['Contato', 'Canal', 'Status', 'Data'].map(h => (
            <span key={h} style={{ ...S.mono, color: 'var(--c-faint)', fontSize: 9 }}>{h}</span>
          ))}
        </div>
        {!recentes?.length && (
          <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>
            Nenhuma conversa registrada ainda.
          </div>
        )}
        {recentes?.map(c => (
          <div key={c.id} className="trow" style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
            <span style={{ fontFamily: 'var(--font-dm)', fontWeight: 500, fontSize: 14, color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {c.contact_identifier || 'Anônimo'}
            </span>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-muted)' }}>{c.channel}</span>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.05em', ...convStyle[c.status] }}>
              {convLabel[c.status]}
            </span>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-faint)' }}>
              {new Date(c.started_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
