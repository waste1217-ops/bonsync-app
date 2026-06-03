import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

export default async function ConversaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Busca conversa + valida que pertence ao agente do cliente
  const { data: conversa } = await supabase
    .from('conversations')
    .select(`*, agents!inner(id, name, client_id)`)
    .eq('id', id)
    .eq('agents.client_id', user!.id)
    .single()

  if (!conversa) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const statusStyle: Record<string, React.CSSProperties> = {
    open:      { color: 'var(--c-yellow)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' },
    resolved:  { color: 'var(--c-green)',  background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.25)' },
    escalated: { color: 'var(--c-red)',    background: 'rgba(232,64,64,0.1)',   border: '1px solid rgba(232,64,64,0.25)' },
  }
  const statusLabel: Record<string, string> = { open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado' }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 800 }}>
      {/* Back */}
      <a href="/painel/conversas" style={{ ...S.mono, color: 'var(--c-muted)', fontSize: 10, display: 'inline-block', marginBottom: 20 }}>
        ← Voltar
      </a>

      {/* Header da conversa */}
      <div className="card-hi" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ ...S.mono, color: 'var(--c-muted)', marginBottom: 8 }}>Conversa</p>
            <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 20, color: 'var(--c-white)', letterSpacing: '-0.02em', marginBottom: 6 }}>
              {conversa.contact_identifier || 'Contato anônimo'}
            </h1>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {[
                ['Canal', conversa.channel],
                ['Início', new Date(conversa.started_at).toLocaleString('pt-BR')],
                ['Mensagens', String(messages?.length ?? 0)],
              ].map(([k, v]) => (
                <div key={k}>
                  <span style={{ ...S.mono, color: 'var(--c-faint)', fontSize: 9 }}>{k}</span>
                  <span style={{ fontFamily: 'var(--font-dm)', fontSize: 13, color: 'var(--c-muted)', display: 'block', marginTop: 2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <span style={{ ...S.mono, fontSize: 10, padding: '6px 14px', borderRadius: 100, ...statusStyle[conversa.status] }}>
            {statusLabel[conversa.status]}
          </span>
        </div>
      </div>

      {/* Chat messages */}
      <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--c-border)' }}>
          {/* Terminal bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['#e84040', '#f59e0b', '#22c55e'].map(c => (
              <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
            ))}
            <span style={{ ...S.mono, color: 'var(--c-muted)', fontSize: 10, marginLeft: 8 }}>
              histórico da conversa
            </span>
          </div>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 600, overflowY: 'auto' }}>
          {!messages?.length && (
            <p style={{ fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', textAlign: 'center', padding: '32px 0', fontWeight: 300 }}>
              Nenhuma mensagem registrada nesta conversa.
            </p>
          )}
          {messages?.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: msg.role === 'user' ? 'row' : 'row-reverse', gap: 12, alignItems: 'flex-start' }}>
              {/* Avatar */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'user' ? 'rgba(80,130,210,0.12)' : 'oklch(55% 0.24 225/0.2)',
                border: `1px solid ${msg.role === 'user' ? 'var(--c-border)' : 'var(--c-border-hi)'}`,
              }}>
                <span style={{ fontFamily: 'var(--font-jb)', fontSize: 9, color: msg.role === 'user' ? 'var(--c-muted)' : 'var(--c-blue-b)' }}>
                  {msg.role === 'user' ? 'USR' : 'AI'}
                </span>
              </div>
              {/* Bubble */}
              <div style={{
                maxWidth: '72%',
                background: msg.role === 'user' ? 'var(--c-surface)' : 'oklch(28% 0.2 225/0.28)',
                border: `1px solid ${msg.role === 'user' ? 'var(--c-border)' : 'var(--c-border-hi)'}`,
                borderRadius: msg.role === 'user' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                padding: '12px 16px',
              }}>
                <p style={{ fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-white)', lineHeight: 1.65, fontWeight: 300, marginBottom: 6 }}>
                  {msg.content}
                </p>
                <span style={{ fontFamily: 'var(--font-jb)', fontSize: 10, color: 'var(--c-faint)' }}>
                  {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Terminal footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--c-border)', background: 'rgba(0,0,0,0.2)' }}>
          <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-muted)' }}>
            <span style={{ color: 'var(--c-blue-b)' }}>$</span> status:{' '}
            <span style={{ color: statusStyle[conversa.status]?.color as string }}>{statusLabel[conversa.status].toLowerCase()}</span>
            {' '}<span className="animate-blink">█</span>
          </span>
        </div>
      </div>
    </div>
  )
}
