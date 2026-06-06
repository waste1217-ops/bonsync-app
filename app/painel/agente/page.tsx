import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT, badgeStyle, agentStatusVariant, agentStatusLabel } from '@/lib/styles'

export const dynamic = 'force-dynamic'

export default async function MeuAgentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: agent } = await supabase.from('agents').select('*').eq('client_id', user!.id).single()

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  const cfg = agent.config ?? {}
  const canais: string[] = cfg.channels ?? ['WhatsApp']
  const inicial = (agent.name || 'A').trim().charAt(0).toUpperCase()
  const tomLabel: Record<string, string> = { profissional: 'Profissional', amigavel: 'Amigável', formal: 'Formal', tecnico: 'Técnico' }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={T.h1}>Meu Agente</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Identidade e configuração do seu assistente.</p>
      </div>

      {/* Cartão principal */}
      <div className="card-hi" style={{ marginBottom: 16, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: 0, top: 0, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle at top right, oklch(55% 0.24 225/0.12) 0%, transparent 65%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 18, alignItems: 'flex-start' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, flexShrink: 0,
            background: 'oklch(55% 0.24 225/0.18)', border: '1px solid oklch(55% 0.24 225/0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: FONT.space, fontWeight: 700, fontSize: 28, color: C.blueB,
          }}>{inicial}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 22, color: C.white, letterSpacing: '-0.02em' }}>{agent.name}</h2>
              <span style={badgeStyle(agentStatusVariant(agent.status))}>{agentStatusLabel[agent.status]}</span>
            </div>
            {agent.description && (
              <p style={{ fontFamily: FONT.dm, fontWeight: 300, fontSize: 14, color: C.muted, marginTop: 8, lineHeight: 1.6 }}>{agent.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Objetivo / instrução */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 10 }}>Objetivo do agente</h3>
        {cfg.prompt ? (
          <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.muted, lineHeight: 1.7, fontWeight: 300, whiteSpace: 'pre-wrap' }}>{cfg.prompt}</p>
        ) : (
          <p style={{ ...T.sub, fontSize: 13 }}>Nenhuma instrução definida ainda. Configure em “Configurações”.</p>
        )}
      </div>

      {/* Detalhes */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 16 }}>Detalhes</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            ['Tom de voz', tomLabel[cfg.tom] ?? '—'],
            ['Modelo de IA', cfg.model ?? 'claude-sonnet-4-5'],
            ['Saudação', cfg.saudacao || '—'],
            ['Atendimento humano', cfg.escalation_mode === 'auto' ? 'Automático' : 'Sob demanda'],
            ['Última atualização', new Date(agent.updated_at || agent.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
            ['Criado em', new Date(agent.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
              <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>{k}</p>
              <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Canais conectados */}
      <div style={{ ...CARD, marginBottom: 16 }}>
        <h3 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 15, color: C.white, marginBottom: 14 }}>Canais conectados</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {canais.map(ch => (
            <div key={ch} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px' }}>
              <span style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{ch}</span>
              <span style={badgeStyle(agent.status === 'active' ? 'green' : 'muted')}>{agent.status === 'active' ? 'online' : 'pausado'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a href="/painel/configuracoes" className="btn-primary" style={{ fontSize: 13 }}>Editar configurações</a>
        <a href="/painel/status" className="btn-ghost" style={{ fontSize: 13 }}>Controlar status</a>
        <a href="/painel/conhecimento" className="btn-ghost" style={{ fontSize: 13 }}>Base de conhecimento</a>
      </div>
    </div>
  )
}
