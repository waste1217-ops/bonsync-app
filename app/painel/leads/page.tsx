import { createClient } from '@/lib/supabase/server'
import { C, T, CARD, FONT } from '@/lib/styles'
import { LeadsBrowser, type Lead } from '@/components/LeadsBrowser'

export const dynamic = 'force-dynamic'

export default async function PainelLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user!.id).single()

  const { data: conversas } = await supabase
    .from('conversations')
    .select('id, contact_identifier, channel, status, lead_status, lead_reason, started_at, message_count')
    .eq('agent_id', agent?.id ?? '')
    .order('lead_updated_at', { ascending: false, nullsFirst: false })
    .order('started_at', { ascending: false })
    .limit(500)

  const leads = (conversas ?? []) as Lead[]
  const qualificados = leads.filter(l => l.lead_status === 'qualificado').length
  const potenciais   = leads.filter(l => l.lead_status === 'potencial').length
  const curiosos     = leads.filter(l => l.lead_status === 'curioso').length

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1000 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Leads</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          A IA classifica cada contato pela intenção de compra. Priorize os qualificados.
        </p>
      </div>

      {/* KPIs com cor por temperatura */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: 'Qualificados', value: qualificados, color: C.green, help: 'Alta intenção — atenda agora' },
          { label: 'Potenciais', value: potenciais, color: C.yellow, help: 'Interesse real, acompanhe' },
          { label: 'Curiosos', value: curiosos, color: C.muted, help: 'Só pesquisando' },
        ].map(k => (
          <div key={k.label} style={{ ...CARD, borderColor: `${k.color}33` }}>
            <p style={{ ...T.mono, color: C.muted, fontSize: 9, marginBottom: 8 }}>{k.label}</p>
            <p style={{ fontFamily: FONT.space, fontWeight: 700, fontSize: 32, color: k.color, lineHeight: 1 }}>{k.value}</p>
            <p style={{ ...T.sub, fontSize: 11, marginTop: 8 }}>{k.help}</p>
          </div>
        ))}
      </div>

      {qualificados > 0 && (
        <div style={{ ...CARD, marginBottom: 16, borderColor: 'rgba(34,197,94,0.35)', background: 'rgba(34,197,94,0.05)' }}>
          <p style={{ fontFamily: FONT.dm, fontSize: 14, color: C.white }}>
            🔥 <b>{qualificados} lead{qualificados > 1 ? 's' : ''} qualificado{qualificados > 1 ? 's' : ''}</b> aguardando atenção — são os mais prováveis de fechar.
          </p>
        </div>
      )}

      <LeadsBrowser leads={leads} />
    </div>
  )
}
