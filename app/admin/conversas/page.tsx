import { createClient } from '@/lib/supabase/server'

const S = {
  mono: { fontFamily: 'var(--font-jb)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase' as const },
}

function formatContact(id: string | null): string {
  if (!id) return 'Anônimo'
  const num = id.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '')
  if (/^55\d{10,11}$/.test(num)) {
    return `+${num.slice(0,2)} (${num.slice(2,4)}) ${num.slice(4,9)}-${num.slice(9)}`
  }
  if (id.includes('@lid')) return `WhatsApp ${num.slice(-6)}`
  return num || 'Anônimo'
}

const statusStyle: Record<string, React.CSSProperties> = {
  open:      { color: 'var(--c-yellow)', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' },
  resolved:  { color: 'var(--c-green)',  background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.2)' },
  escalated: { color: 'var(--c-red)',    background: 'rgba(232,64,64,0.1)',   border: '1px solid rgba(232,64,64,0.2)' },
}
const statusLabel: Record<string, string> = { open: 'Em aberto', resolved: 'Resolvido', escalated: 'Escalado' }

export default async function AdminConversasPage() {
  const supabase = await createClient()
  const { data: conversas } = await supabase
    .from('conversations')
    .select('*, agents(name, profiles(company_name))')
    .order('started_at', { ascending: false })
    .limit(300)

  const all       = conversas ?? []
  const total     = all.length
  const resolved  = all.filter(c => c.status === 'resolved').length
  const escalated = all.filter(c => c.status === 'escalated').length

  // Agrupa por cliente (empresa)
  const grupos: Record<string, { empresa: string; convs: any[] }> = {}
  for (const c of all) {
    const empresa = (c.agents as any)?.profiles?.company_name ?? 'Sem cliente'
    const key = empresa
    if (!grupos[key]) grupos[key] = { empresa, convs: [] }
    grupos[key].convs.push(c)
  }
  // Ordena clientes por nº de conversas (desc)
  const gruposOrdenados = Object.values(grupos).sort((a, b) => b.convs.length - a.convs.length)

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 24, color: 'var(--c-white)', letterSpacing: '-0.025em', marginBottom: 4 }}>
          Conversas por cliente
        </h1>
        <p style={{ fontFamily: 'var(--font-dm)', fontWeight: 300, fontSize: 14, color: 'var(--c-muted)' }}>
          Atendimentos agrupados por cliente da plataforma.
        </p>
      </div>

      {/* KPIs rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Clientes', value: gruposOrdenados.length },
          { label: 'Total de conversas', value: total },
          { label: 'Resolvidas', value: resolved },
          { label: 'Escaladas', value: escalated },
        ].map(s => (
          <div key={s.label} className="card">
            <p style={{ ...S.mono, color: 'var(--c-muted)', fontSize: 9, marginBottom: 8 }}>{s.label}</p>
            <p style={{ fontFamily: 'var(--font-space)', fontWeight: 700, fontSize: 30, color: 'var(--c-blue-b)', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {!all.length && (
        <div style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, padding: '60px 24px', textAlign: 'center', fontFamily: 'var(--font-dm)', fontSize: 14, color: 'var(--c-muted)', fontWeight: 300 }}>
          Nenhuma conversa registrada ainda.
        </div>
      )}

      {/* Blocos por cliente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {gruposOrdenados.map(g => {
          const abertas = g.convs.filter(c => c.status === 'open').length
          return (
            <div key={g.empresa} style={{ background: 'var(--c-deep)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* Cabeçalho do cliente */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid var(--c-border)', background: 'rgba(80,130,210,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'var(--font-space)', fontWeight: 600, fontSize: 16, color: 'var(--c-white)' }}>{g.empresa}</span>
                  <span style={{ ...S.mono, fontSize: 9, color: 'var(--c-blue-b)', background: 'oklch(55% 0.24 225/0.12)', border: '1px solid oklch(55% 0.24 225/0.25)', padding: '3px 9px', borderRadius: 100 }}>
                    {g.convs.length} conversa{g.convs.length > 1 ? 's' : ''}
                  </span>
                </div>
                {abertas > 0 && (
                  <span style={{ ...S.mono, fontSize: 9, ...statusStyle.open, padding: '3px 9px', borderRadius: 100 }}>
                    {abertas} em aberto
                  </span>
                )}
              </div>

              {/* Col headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, padding: '8px 24px', borderBottom: '1px solid rgba(80,130,210,0.08)' }}>
                {['Contato', 'Canal', 'Status', 'Data'].map(h => (
                  <span key={h} style={{ ...S.mono, color: 'var(--c-faint)', fontSize: 9 }}>{h}</span>
                ))}
              </div>

              {/* Conversas do cliente */}
              {g.convs.map((c: any) => (
                <a key={c.id} href={`/admin/conversas/${c.id}`} className="trow" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, cursor: 'pointer' }}>
                  <span style={{ fontFamily: 'var(--font-dm)', fontWeight: 500, fontSize: 14, color: 'var(--c-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {formatContact(c.contact_identifier)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-muted)' }}>{c.channel}</span>
                  <span style={{ ...S.mono, fontSize: 9, padding: '4px 10px', borderRadius: 100, width: 'fit-content', ...statusStyle[c.status] }}>
                    {statusLabel[c.status]}
                  </span>
                  <span style={{ fontFamily: 'var(--font-jb)', fontSize: 11, color: 'var(--c-faint)' }}>
                    {new Date(c.started_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </a>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
