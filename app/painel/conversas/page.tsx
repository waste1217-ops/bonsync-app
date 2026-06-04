import { createClient } from '@/lib/supabase/server'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  // Remove sufixos WhatsApp e formata número brasileiro
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  // Se parece número brasileiro (55 + DDD + número)
  if (/^55\d{10,11}$/.test(num)) {
    return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  }
  // @lid ou número não reconhecido — mostra só os últimos dígitos
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}

export default async function PainelConversasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: agent } = await supabase
    .from('agents').select('id').eq('client_id', user!.id).single()

  const { data: conversas } = await supabase
    .from('conversations').select('*')
    .eq('agent_id', agent?.id ?? '')
    .order('started_at', { ascending: false })

  const statusStyle: Record<string, React.CSSProperties> = {
    open:      { color: 'var(--c-yellow)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' },
    resolved:  { color: 'var(--c-green)',  background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.2)' },
    escalated: { color: 'var(--c-red)',    background: 'rgba(232,64,64,0.1)',   border: '1px solid rgba(232,64,64,0.2)' },
  }
  const statusLabel: Record<string, string> = { open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado' }

  const total     = conversas?.length ?? 0
  const resolved  = conversas?.filter(c => c.status === 'resolved').length ?? 0
  const escalated = conversas?.filter(c => c.status === 'escalated').length ?? 0
  const open      = conversas?.filter(c => c.status === 'open').length ?? 0

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Conversas
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          {total} conversa{total !== 1 ? 's' : ''} registrada{total !== 1 ? 's' : ''} pelo agente.
        </p>
      </div>

      {/* Filtros rápidos */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: `Todas (${total})`,        value: 'all' },
          { label: `Em aberto (${open})`,     value: 'open' },
          { label: `Resolvidas (${resolved})`, value: 'resolved' },
          { label: `Escaladas (${escalated})`, value: 'escalated' },
        ].map(f => (
          <span key={f.value} style={{ ...S.mono, fontSize: 10, padding: '6px 14px', borderRadius: 100, cursor: 'pointer', border: '1px solid var(--c-border)', color: 'var(--c-muted)' }}>
            {f.label}
          </span>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16, padding: '10px 24px', borderBottom: '1px solid rgba(80,130,210,0.08)' }}>
          {['Contato', 'Canal', 'Status', 'Mensagens', 'Início'].map(h => (
            <span key={h} style={{ ...S.mono, color: 'var(--c-faint)', fontSize: 9 }}>{h}</span>
          ))}
        </div>

        {!conversas?.length && (
          <div style={{ padding: '60px 24px', textAlign: 'center', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>
            Nenhuma conversa registrada ainda. Elas aparecerão aqui quando o agente começar a atender.
          </div>
        )}

        {conversas?.map(c => (
          <a key={c.id} href={`/painel/conversas/${c.id}`}
            className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 16, cursor: 'pointer' }}>
            <span style={{ fontFamily: 'var(--font-dm)', fontWeight: 500, fontSize: 14, color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {formatContact(c.contact_identifier)}
            </span>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-muted)' }}>{c.channel}</span>
            <span style={{ ...S.mono, fontSize: 9, padding: '4px 10px', borderRadius: 100, width: 'fit-content', ...statusStyle[c.status] }}>
              {statusLabel[c.status]}
            </span>
            <span style={{ fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)' }}>{c.message_count}</span>
            <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-faint)' }}>
              {new Date(c.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
          </a>
        ))}
      </div>
    </div>
  )
}
