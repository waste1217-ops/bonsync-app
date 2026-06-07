import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { LeadsCentral, type Lead } from '@/components/LeadsCentral'

export const dynamic = 'force-dynamic'

const STOPWORDS = new Set(['a','o','e','é','de','do','da','que','em','um','uma','para','com','não','nao','os','as','no','na','se','por','mais','dos','das','ao','meu','minha','seu','sua','isso','isto','esse','essa','este','esta','como','mas','ou','já','ja','eu','você','voce','vc','me','te','nos','ele','ela','foi','ser','está','esta','estou','tem','ter','vai','quero','queria','pode','sim','bom','boa','dia','tarde','noite','oi','olá','ola','obrigado','obrigada','favor','aqui','tudo','bem','então','entao','pra','pro','até','ate','sobre','quanto','qual','quais','onde','quando','sou','the','isso','meu'])

export default async function PainelLeadsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user!.id).single()
  const aid = agent?.id ?? ''

  const { data: conversas } = await supabase
    .from('conversations')
    .select('id, contact_identifier, channel, status, lead_status, lead_reason, lead_updated_at, started_at, message_count')
    .eq('agent_id', aid)
    .order('lead_updated_at', { ascending: false, nullsFirst: false })
    .order('started_at', { ascending: false }).limit(400)
  const convs = conversas ?? []

  // Negócios por contato → pipeline
  const { data: deals } = await supabase.from('deals').select('contact_identifier, status').eq('agent_id', aid)
  const dealMap: Record<string, string> = {}
  for (const d of deals ?? []) {
    const cur = dealMap[d.contact_identifier]
    if (d.status === 'confirmed' || !cur) dealMap[d.contact_identifier] = d.status
  }

  // Mensagens dos clientes p/ última mensagem + interesse (limita às conversas mais recentes)
  const ids = convs.slice(0, 200).map(c => c.id)
  const ultimaMsgMap: Record<string, string> = {}
  const interesseMap: Record<string, string> = {}
  const freqGlobal: Record<string, number> = {}
  if (ids.length) {
    const { data: msgs } = await supabase.from('messages').select('conversation_id, content, created_at')
      .in('conversation_id', ids).eq('role', 'user').order('created_at', { ascending: false }).limit(2000)
    const freqLocal: Record<string, Record<string, number>> = {}
    for (const m of msgs ?? []) {
      const cid = m.conversation_id
      if (!ultimaMsgMap[cid]) ultimaMsgMap[cid] = String(m.content || '').slice(0, 70)
      for (const p of String(m.content || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
        if (p.length < 4 || STOPWORDS.has(p)) continue
        ;(freqLocal[cid] ??= {})[p] = ((freqLocal[cid] ??= {})[p] ?? 0) + 1
        freqGlobal[p] = (freqGlobal[p] ?? 0) + 1
      }
    }
    for (const cid of Object.keys(freqLocal)) {
      const top = Object.entries(freqLocal[cid]).sort((a, b) => b[1] - a[1])[0]
      if (top) interesseMap[cid] = top[0].charAt(0).toUpperCase() + top[0].slice(1)
    }
  }

  const leads: Lead[] = convs.map(c => {
    const dealSt = dealMap[c.contact_identifier ?? '']
    const pipeline: Lead['pipeline'] = dealSt === 'confirmed' ? 'convertido'
      : dealSt === 'pending' ? 'em_contato'
      : c.status === 'resolved' ? 'perdido' : 'novo'
    return {
      id: c.id, contact_identifier: c.contact_identifier, channel: c.channel, status: c.status,
      lead_status: c.lead_status, lead_reason: c.lead_reason, started_at: c.started_at,
      message_count: c.message_count ?? 0,
      ultimaMsg: ultimaMsgMap[c.id] || '',
      interesse: interesseMap[c.id] || 'Atendimento comercial',
      pipeline,
    }
  })

  const termos = Object.entries(freqGlobal).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([termo, n]) => ({ termo, n }))

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Leads</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>Veja os contatos identificados pela IA, acompanhe o nível de interesse e priorize quem tem mais chance de comprar.</p>
      </div>
      <LeadsCentral leads={leads} termos={termos} />
    </div>
  )
}
