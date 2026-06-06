import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { notFound } from 'next/navigation'
import { C, T, L, CARD, CARD_HI, TABLE, FONT, badgeStyle, agentStatusVariant, agentStatusLabel, convStatusVariant, convStatusLabel } from '@/lib/styles'
import { AgentToggle } from './AgentToggle'
import { DeleteButton } from '@/components/DeleteButton'
import { DuplicateAgentButton } from '@/components/DuplicateAgentButton'
import { SaveAsTemplateButton } from '@/components/SaveAsTemplateButton'
import { sumTokens, estimateCostBRL, fmtTokens, fmtBRL } from '@/lib/usage'

export default async function AgenteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: agent } = await supabase
    .from('agents')
    .select('*, profiles(id, email, company_name)')
    .eq('id', id)
    .single()

  if (!agent) notFound()

  const { data: conversas } = await supabase
    .from('conversations')
    .select('*')
    .eq('agent_id', id)
    .order('started_at', { ascending: false })
    .limit(15)

  const total    = conversas?.length ?? 0
  const resolved = conversas?.filter(c => c.status === 'resolved').length ?? 0

  // Consumo de tokens: busca todas as mensagens das conversas deste agente
  const { data: convIdsData } = await supabase
    .from('conversations').select('id').eq('agent_id', id)
  const convIds = (convIdsData ?? []).map(c => c.id)
  let tokens = { inputTokens: 0, outputTokens: 0 }
  if (convIds.length > 0) {
    const { data: msgs } = await supabase
      .from('messages').select('input_tokens, output_tokens').in('conversation_id', convIds)
    tokens = sumTokens(msgs ?? [])
  }
  const custo = estimateCostBRL(tokens, agent.config?.model)

  const cliente = agent.profiles as any

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>

      {/* Back */}
      <div style={{ marginBottom: 28 }}>
        <a href="/admin/agentes" style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 16 }}>
          ← Agentes
        </a>

        {/* Header card */}
        <div style={{ ...CARD_HI, position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: 0, top: 0, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle at top right, oklch(55% 0.24 225/0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <p style={{ ...T.mono, color: C.muted, marginBottom: 8 }}>Agente</p>
                <h1 style={{ ...T.h1, fontSize: 28, marginBottom: 8 }}>{agent.name}</h1>
                {agent.description && <p style={T.sub}>{agent.description}</p>}
                {Array.isArray(agent.tags) && agent.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {agent.tags.map((t: string) => (
                      <span key={t} style={badgeStyle('blue')}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 20, marginTop: 16, flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>Cliente</p>
                    <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white }}>{cliente?.company_name || '—'}</p>
                  </div>
                  <div>
                    <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>Modelo</p>
                    <p style={{ fontFamily: FONT.jb, fontSize: 12, color: C.blueB }}>{agent.config?.model ?? 'não definido'}</p>
                  </div>
                  <div>
                    <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>Criado em</p>
                    <p style={{ fontFamily: FONT.jb, fontSize: 12, color: C.muted }}>{new Date(agent.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                  </div>
                </div>
              </div>
              {/* Toggle de status — componente client */}
              <AgentToggle agentId={id} initialStatus={agent.status} />
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
        {[
          { label: 'Total de conversas', value: total },
          { label: 'Resolvidas',         value: resolved },
          { label: 'Taxa de resolução',  value: total ? `${Math.round((resolved / total) * 100)}%` : '—' },
        ].map(k => (
          <div key={k.label} style={CARD}>
            <p style={{ ...T.mono, color: C.muted, marginBottom: 10 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 32, color: C.blueB, letterSpacing: '-0.03em', lineHeight: 1 }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Consumo de tokens */}
      <div style={{ ...CARD, marginBottom: 20 }}>
        <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 4 }}>
          Consumo de IA
        </h2>
        <p style={{ ...T.sub, fontSize: 12, marginBottom: 20 }}>Tokens processados e custo estimado deste agente.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[
            { label: 'Tokens entrada', value: fmtTokens(tokens.inputTokens),  color: C.blueB },
            { label: 'Tokens saída',   value: fmtTokens(tokens.outputTokens), color: C.blueB },
            { label: 'Custo estimado', value: fmtBRL(custo),                  color: C.green },
          ].map(k => (
            <div key={k.label} style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '16px 18px' }}>
              <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{k.label}</p>
              <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 24, color: k.color, letterSpacing: '-0.02em', lineHeight: 1 }}>
                {k.value}
              </p>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: FONT.jb, fontSize: 9, color: C.faint, marginTop: 12 }}>
          * Custo estimado com base no modelo {agent.config?.model ?? 'padrão'}. Valores aproximados.
        </p>
      </div>

      {/* Config atual */}
      <div style={{ ...CARD, marginBottom: 20 }}>
        <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${C.border}` }}>
          Configuração atual
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {[
            ['Tom de voz', agent.config?.tom ?? '—'],
            ['Escalar após', `${agent.config?.escalarApos ?? 15} mensagens`],
            ['Saudação', agent.config?.saudacao || '—'],
            ['Canais', (agent.config?.channels ?? ['WhatsApp']).join(', ')],
          ].map(([k, v]) => (
            <div key={k} style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
              <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 4 }}>{k}</p>
              <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>{v}</p>
            </div>
          ))}
        </div>
        {agent.config?.prompt && (
          <div style={{ marginTop: 16 }}>
            <p style={{ ...T.mono, color: C.faint, fontSize: 9, marginBottom: 8 }}>Prompt do sistema</p>
            <div style={{ background: C.void, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 16px' }}>
              <p style={{ fontFamily: FONT.dm, fontSize: 13, color: C.muted, lineHeight: 1.7, fontWeight: 300 }}>
                {agent.config.prompt}
              </p>
            </div>
          </div>
        )}
        <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={`/admin/agentes/${id}/editar`} className="btn-ghost" style={{ fontSize: 12, padding: '9px 18px' }}>
            Editar configuração
          </a>
          <a href={`/admin/agentes/${id}/versoes`} className="btn-ghost" style={{ fontSize: 12, padding: '9px 18px' }}>
            Histórico de versões
          </a>
          <DuplicateAgentButton agentId={id} />
          <SaveAsTemplateButton agentId={id} agentName={agent.name} />
          <DeleteButton
            label="Excluir agente"
            confirmText={`Tem certeza que deseja excluir o agente "${agent.name}"? Todas as conversas e métricas serão perdidas.`}
            apiRoute="/api/admin/delete-agent"
            body={{ agent_id: id }}
            redirectTo="/admin/agentes"
          />
        </div>
      </div>

      {/* Conversas */}
      <div style={TABLE}>
        <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
          <h2 style={{ fontFamily: FONT.space, fontWeight: 600, fontSize: 16, color: C.white }}>Conversas recentes</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: `1px solid rgba(80,130,210,0.08)` }}>
          {['Contato', 'Canal', 'Status', 'Data'].map(h => (
            <span key={h} style={T.tableHead}>{h}</span>
          ))}
        </div>
        {!conversas?.length && (
          <div style={{ padding: '40px 24px', textAlign: 'center', ...T.sub }}>Nenhuma conversa registrada.</div>
        )}
        {conversas?.map(c => (
          <a key={c.id} href={`/admin/conversas/${c.id}`} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, cursor: 'pointer' }}>
            <span style={T.cell}>{c.contact_identifier || 'Anônimo'}</span>
            <span style={T.cellMono}>{c.channel}</span>
            <span style={badgeStyle(convStatusVariant(c.status))}>{convStatusLabel[c.status]}</span>
            <span style={T.cellMono}>{new Date(c.started_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
          </a>
        ))}
      </div>
    </div>
  )
}
