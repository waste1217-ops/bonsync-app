import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { C, T, FONT, badgeStyle, convStatusVariant, convStatusLabel } from '@/lib/styles'
import { MessageRating } from '@/components/MessageRating'
import { FavoriteToggle } from '@/components/FavoriteToggle'

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) {
    return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  }
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}

export default async function AdminConversaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Admin vê qualquer conversa (RLS já garante que só admin acessa /admin)
  const { data: conversa } = await supabase
    .from('conversations')
    .select(`*, agents(id, name, profiles(company_name))`)
    .eq('id', id)
    .single()

  if (!conversa) notFound()

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', id)
    .order('created_at', { ascending: true })

  const agent = conversa.agents as any

  return (
    <div className="animate-slide-up" style={{ maxWidth: 820 }}>
      {/* Back */}
      <a href="/admin/conversas" style={{ ...T.mono, color: C.muted, fontSize: 10, display: 'inline-block', marginBottom: 20 }}>
        ← Conversas
      </a>

      {/* Header */}
      <div className="card-hi" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <p style={{ ...T.mono, color: C.muted, marginBottom: 8 }}>Conversa</p>
            <h1 style={{ ...T.h1, fontSize: 22, marginBottom: 8 }}>{formatContact(conversa.contact_identifier)}</h1>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
              {[
                ['Cliente', agent?.profiles?.company_name ?? '—'],
                ['Agente', agent?.name ?? '—'],
                ['Canal', conversa.channel],
                ['Mensagens', String(messages?.length ?? 0)],
                ['Início', new Date(conversa.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })],
              ].map(([k, v]) => (
                <div key={k}>
                  <span style={{ ...T.mono, color: C.faint, fontSize: 9 }}>{k}</span>
                  <span style={{ fontFamily: FONT.dm, fontSize: 13, color: C.white, display: 'block', marginTop: 2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <span style={badgeStyle(convStatusVariant(conversa.status))}>{convStatusLabel[conversa.status]}</span>
            <FavoriteToggle conversationId={id} initial={conversa.is_favorite ?? false} />
          </div>
        </div>
      </div>

      {/* Chat */}
      <div style={{ background: C.deep, border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
          {['#e84040', '#f59e0b', '#22c55e'].map(c => (
            <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
          ))}
          <span style={{ ...T.mono, color: C.muted, fontSize: 10, marginLeft: 8 }}>histórico da conversa</span>
        </div>

        <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: 600, overflowY: 'auto' }}>
          {!messages?.length && (
            <p style={{ ...T.sub, textAlign: 'center', padding: '32px 0' }}>
              Nenhuma mensagem registrada nesta conversa.
            </p>
          )}
          {messages?.map(msg => {
            const isUser = msg.role === 'user'
            return (
              <div key={msg.id} style={{ display: 'flex', flexDirection: isUser ? 'row' : 'row-reverse', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isUser ? 'rgba(80,130,210,0.12)' : 'oklch(55% 0.24 225/0.2)',
                  border: `1px solid ${isUser ? C.border : C.borderHi}`,
                }}>
                  <span style={{ fontFamily: FONT.jb, fontSize: 9, color: isUser ? C.muted : C.blueB }}>
                    {isUser ? 'USR' : 'AI'}
                  </span>
                </div>
                <div style={{
                  maxWidth: '72%',
                  background: isUser ? C.surface : 'oklch(28% 0.2 225/0.28)',
                  border: `1px solid ${isUser ? C.border : C.borderHi}`,
                  borderRadius: isUser ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                  padding: '12px 16px',
                }}>
                  <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white, lineHeight: 1.65, fontWeight: 300, marginBottom: 6, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </p>
                  <span style={{ fontFamily: FONT.jb, fontSize: 10, color: C.faint, display: 'inline-flex', alignItems: 'center' }}>
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })}
                    {!isUser && <MessageRating messageId={msg.id} initial={msg.rating ?? null} />}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
