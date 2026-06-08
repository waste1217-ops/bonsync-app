import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'
import { AgentPauseToggle } from '@/components/AgentPauseToggle'

export const dynamic = 'force-dynamic'

const tomLabel: Record<string, string> = {
  profissional: 'Profissional', amigavel: 'Amigável e profissional', formal: 'Formal', tecnico: 'Técnico',
}
const modeloLabel: Record<string, string> = {
  'claude-opus-4-5': 'Máximo', 'claude-sonnet-4-5': 'Avançado', 'claude-haiku-3-5': 'Rápido',
}

function Tag({ children, cor = 'var(--c-blue-b)' }: { children: React.ReactNode; cor?: string }) {
  return (
    <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: 'var(--c-white)', background: `color-mix(in oklch, ${cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 28%, transparent)`, borderRadius: 100, padding: '5px 12px' }}>
      {children}
    </span>
  )
}

export default async function MeuAgentePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
  const { data: agent } = await supabase.from('agents').select('*').eq('client_id', user!.id).single()

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  const cfg = agent.config ?? {}
  const profile = cfg.profile ?? {}
  const canais: string[] = cfg.channels ?? ['WhatsApp']
  const inicial = (agent.name || 'A').trim().charAt(0).toUpperCase()
  const ativo = agent.status === 'active'
  const stLabel: Record<string, string> = { active: 'Ativo', paused: 'Pausado', error: 'Erro' }
  const stCor: Record<string, string> = { active: 'var(--c-green)', paused: 'var(--c-yellow)', error: 'var(--c-red)' }
  const cor = stCor[agent.status] ?? 'var(--c-muted)'

  // Última atividade = conversa mais recente
  const { data: ult } = await supabase.from('conversations').select('started_at')
    .eq('agent_id', agent.id).order('started_at', { ascending: false }).limit(1).single()
  const ultimaAtividade = ult?.started_at ?? agent.updated_at ?? agent.created_at

  // Conhecimento principal (itens reais da base)
  const { data: kb } = await supabase.from('knowledge_base').select('content')
    .eq('agent_id', agent.id).eq('active', true).order('created_at', { ascending: true }).limit(10)
  const conhecimento = (kb ?? []).map(k => String(k.content).replace(/^\[[^\]]+\]\s*/, '').trim()).filter(Boolean)

  const servicos: string[] = Array.isArray(profile.servicos) ? profile.servicos : []
  const integracoes: string[] = Array.isArray(profile.integracoes) ? profile.integracoes : []

  const fmt = (d: string) => new Date(d).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const cardTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 14 } as React.CSSProperties
  const sideTitle = { fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, marginBottom: 12 } as React.CSSProperties
  const rowLabel = { ...T.mono, fontSize: 9, color: C.faint } as React.CSSProperties
  const rowVal = { fontFamily: FONT.dm, fontSize: 13.5, color: C.white } as React.CSSProperties

  // Blocos do objetivo comercial (só os preenchidos)
  const objBlocos = [
    ['Especialidade', profile.especialidade],
    ['Público atendido', profile.publico],
    ['Principal meta', profile.meta],
    ['Região de atuação', profile.regiao],
  ].filter(([, v]) => v)

  // "Como o agente atende"
  const comoAtende: [string, string, string][] = [
    ['Tom de voz', tomLabel[cfg.tom] ?? '—', 'var(--c-blue-b)'],
    ['Saudação inicial', cfg.saudacao || 'Olá! Como posso te ajudar hoje?', 'var(--c-blue-b)'],
    ['Objetivo nas conversas', profile.objetivo_conversas || 'Tirar dúvidas, qualificar leads e coletar informações comerciais', 'var(--c-blue-b)'],
    ['Atendimento humano', cfg.escalation_mode === 'auto' ? 'Automático' : 'Sob demanda', 'var(--c-yellow)'],
    ['Classificação de leads', 'Ativa', 'var(--c-green)'],
    ['Resposta automática', ativo ? 'Ativa' : 'Pausada', ativo ? 'var(--c-green)' : 'var(--c-yellow)'],
  ]

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1200 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Meu Agente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Configure a identidade, comportamento e canais do seu agente de atendimento.</p>
      </div>

      <div className="ag-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.9fr) minmax(0,1fr)', gap: 20, alignItems: 'start' }}>

        {/* ───── ESQUERDA ───── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Perfil do agente */}
          <div className="card-hi" style={{ position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', right: -30, top: -30, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, oklch(60% 0.2 220/0.14) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{ width: 60, height: 60, borderRadius: 18, flexShrink: 0, background: 'oklch(55% 0.24 225/0.18)', border: '1px solid oklch(60% 0.2 225/0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: FONT.space, fontWeight: 700, fontSize: 26, color: C.blueB }}>{inicial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <h2 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 22, color: C.white, letterSpacing: '-0.02em' }}>{agent.name}</h2>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...T.mono, fontSize: 9, color: cor, padding: '4px 10px', borderRadius: 100, background: `color-mix(in oklch, ${cor} 12%, transparent)`, border: `1px solid color-mix(in oklch, ${cor} 30%, transparent)` }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cor }} className={ativo ? 'animate-pulse-dot' : ''} />{stLabel[agent.status]}
                    </span>
                  </div>
                  {agent.description && <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{agent.description}</p>}
                  <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginTop: 14 }}>
                    {[['Canal principal', canais[0] ?? 'WhatsApp'], ['Modo', ativo ? 'Respondendo automaticamente' : 'Pausado'], ['Última atualização', fmt(agent.updated_at ?? agent.created_at)]].map(([k, v]) => (
                      <div key={k}><p style={rowLabel}>{k}</p><p style={{ ...rowVal, marginTop: 3 }}>{v}</p></div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
                <a href="/painel/configuracoes" className="btn-primary" style={{ fontSize: 13 }}>Editar agente</a>
                <a href="/painel/assistente" className="btn-ghost" style={{ fontSize: 13 }}>Testar agente</a>
                <AgentPauseToggle agentId={agent.id} status={agent.status} />
              </div>
            </div>
          </div>

          {/* Objetivo comercial */}
          <div style={CARD}>
            <h2 style={cardTitle}>Objetivo comercial</h2>
            <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.muted, lineHeight: 1.65, fontWeight: 300 }}>
              {profile.objetivo || agent.description || 'Defina o objetivo comercial do seu agente em Configurações → Perfil comercial.'}
            </p>
            {objBlocos.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                {objBlocos.map(([k, v]) => (
                  <div key={k as string} style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px' }}>
                    <p style={rowLabel}>{k}</p>
                    <p style={{ ...rowVal, marginTop: 4, fontWeight: 400 }}>{v as string}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Como o agente atende */}
          <div style={CARD}>
            <h2 style={cardTitle}>Como o agente atende</h2>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {comoAtende.map(([k, v, c], i) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '11px 0', borderBottom: i < comoAtende.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{k}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 13.5, color: c, textAlign: 'right', fontWeight: 400, maxWidth: '60%' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Conhecimento principal */}
          <div style={CARD}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <h2 style={cardTitle}>Conhecimento principal</h2>
              <a href="/painel/conhecimento" style={{ ...T.mono, fontSize: 9, color: C.blueB }}>Gerenciar →</a>
            </div>
            <p style={{ ...T.sub, fontSize: 12, marginBottom: 14 }}>O que o agente sabe sobre o seu negócio e usa nas respostas.</p>
            {conhecimento.length === 0 ? (
              <p style={{ ...T.sub, fontSize: 13 }}>Nenhum conhecimento cadastrado ainda. Adicione em <a href="/painel/conhecimento" style={{ color: C.blueB }}>Conhecimento</a>.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {conhecimento.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 9 }}>
                    <span style={{ color: 'oklch(80% 0.16 215)', fontSize: 12, flexShrink: 0, lineHeight: 1.5 }}>•</span>
                    <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, fontWeight: 300, lineHeight: 1.5, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{c}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Serviços e integrações */}
          {(servicos.length > 0 || integracoes.length > 0) && (
            <div style={CARD}>
              <h2 style={cardTitle}>Serviços e integrações</h2>
              {servicos.length > 0 && (
                <div style={{ marginBottom: integracoes.length ? 16 : 0 }}>
                  <p style={{ ...rowLabel, marginBottom: 10 }}>Serviços</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{servicos.map(s => <Tag key={s} cor="var(--c-green)">{s}</Tag>)}</div>
                </div>
              )}
              {integracoes.length > 0 && (
                <div>
                  <p style={{ ...rowLabel, marginBottom: 10 }}>Integrações</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{integracoes.map(s => <Tag key={s}>{s}</Tag>)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ───── DIREITA ───── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Status operacional */}
          <div style={CARD}>
            <h2 style={sideTitle}>Status operacional</h2>
            {[
              ['Status do agente', stLabel[agent.status], cor],
              ['Canal principal', canais[0] ?? 'WhatsApp', C.white],
              ['Modo de resposta', ativo ? 'Automático' : 'Pausado', ativo ? 'var(--c-green)' : 'var(--c-yellow)'],
              ['Última atividade', fmt(ultimaAtividade), C.white],
              ['Última atualização', fmt(agent.updated_at ?? agent.created_at), C.white],
              ['Saúde do agente', agent.status === 'error' ? 'Erro' : ativo ? 'Normal' : 'Pausado', agent.status === 'error' ? 'var(--c-red)' : ativo ? 'var(--c-green)' : 'var(--c-yellow)'],
            ].map(([k, v, c], i, arr) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span style={rowLabel}>{k}</span>
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: c as string, textAlign: 'right' }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Canais conectados */}
          <div style={CARD}>
            <h2 style={sideTitle}>Canais conectados</h2>
            <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, fontWeight: 500 }}>WhatsApp</span>
                <span style={{ ...T.mono, fontSize: 9, color: ativo ? 'var(--c-green)' : 'var(--c-yellow)' }}>{ativo ? 'Online' : 'Pausado'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ ...T.sub, fontSize: 11 }}>Resposta automática</span>
                <span style={{ fontFamily: FONT.jb, fontSize: 10, color: ativo ? 'var(--c-green)' : 'var(--c-muted)' }}>{ativo ? 'Ativa' : 'Pausada'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ ...T.sub, fontSize: 11 }}>Última mensagem</span>
                <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint }}>{fmt(ultimaAtividade)}</span>
              </div>
            </div>
            {['Instagram', 'Site'].filter(c => !canais.includes(c)).map(ch => (
              <div key={ch} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', opacity: 0.6 }}>
                <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted }}>{ch}</span>
                <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>Não conectado</span>
              </div>
            ))}
            <a href="/painel/status" className="btn-ghost" style={{ fontSize: 12, padding: '8px 14px', width: '100%', textAlign: 'center', marginTop: 8, display: 'block' }}>Gerenciar canal</a>
          </div>

          {/* Configurações rápidas */}
          <div style={CARD}>
            <h2 style={sideTitle}>Configurações rápidas</h2>
            {[
              ['Tom de voz', tomLabel[cfg.tom] ?? '—'],
              ['Mensagem inicial', cfg.saudacao || '—'],
              ['Quando chamar humano', cfg.escalation_mode === 'auto' ? 'Automático' : 'Sob demanda'],
              ['Status do agente', stLabel[agent.status]],
              ['Canal principal', canais[0] ?? 'WhatsApp'],
            ].map(([k, v], i, arr) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span style={rowLabel}>{k}</span>
                <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '55%' }}>{v}</span>
              </div>
            ))}
            <a href="/painel/configuracoes" className="btn-primary" style={{ fontSize: 12, padding: '9px 14px', width: '100%', textAlign: 'center', marginTop: 14, display: 'block' }}>Editar configurações</a>
          </div>

          {/* Ações rápidas */}
          <div style={CARD}>
            <h2 style={sideTitle}>Ações rápidas</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ['Testar agente', '/painel/assistente'],
                ['Editar configurações', '/painel/configuracoes'],
                ['Ver base de conhecimento', '/painel/conhecimento'],
                ['Controlar status', '/painel/status'],
                ['Ver conversas', '/painel/conversas'],
              ].map(([t, h]) => (
                <a key={h} href={h} className="nav-item" style={{ fontSize: 13, padding: '9px 12px', justifyContent: 'space-between' }}>{t}<span style={{ color: C.faint }}>→</span></a>
              ))}
            </div>
          </div>

          {/* Configurações avançadas (recolhida) */}
          <details style={{ ...CARD }}>
            <summary style={{ cursor: 'pointer', fontFamily: FONT.space, fontWeight: 600, fontSize: 14, color: C.white, listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Configurações avançadas
              <span style={{ ...T.mono, fontSize: 9, color: C.faint }}>técnico</span>
            </summary>
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column' }}>
              {[
                ['Modelo de IA', modeloLabel[cfg.model] ?? 'Avançado'],
                ['Regras automáticas', 'Ativas'],
                ['Classificação de leads', 'Ativa'],
                ['Escalação para humano', cfg.escalation_mode === 'auto' ? 'Automática' : 'Sob demanda'],
                ['Segurança / guardrails', 'Ativos'],
              ].map(([k, v], i, arr) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                  <span style={rowLabel}>{k}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 12.5, color: C.muted }}>{v}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>

      <style>{`@media (max-width: 980px){ .ag-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  )
}
