import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { ConversasCentral, type Conv } from '@/components/ConversasCentral'
import { LimparHistorico } from '@/components/LimparHistorico'

export const dynamic = 'force-dynamic'

const STOPWORDS = new Set(['a','o','e','é','de','do','da','que','em','um','uma','para','com','não','nao','os','as','no','na','se','por','mais','dos','das','ao','meu','minha','seu','sua','isso','isto','esse','essa','este','esta','como','mas','ou','já','ja','eu','você','voce','vc','me','te','nos','ele','ela','foi','ser','está','esta','estou','tem','ter','vai','quero','queria','pode','sim','bom','boa','dia','tarde','noite','oi','olá','ola','obrigado','obrigada','favor','aqui','tudo','bem','então','entao','pra','pro','até','ate','sobre','quanto','qual','quais','onde','quando','sou','the'])

export default async function PainelConversasPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession(); const user = session?.user
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user!.id).single()
  const aid = agent?.id ?? ''

  const { data: conversas } = await supabase
    .from('conversations')
    .select('id, contact_identifier, channel, status, started_at, ended_at, message_count, lead_status, lead_reason')
    .eq('agent_id', aid).order('started_at', { ascending: false }).limit(500)
  const all = (conversas ?? []) as Conv[]

  // Assuntos mais perguntados (para insights)
  let termos: string[] = []
  const ids = all.slice(0, 200).map(c => c.id)
  if (ids.length) {
    const { data: msgs } = await supabase.from('messages').select('content').in('conversation_id', ids).eq('role', 'user').limit(800)
    const freq: Record<string, number> = {}
    for (const m of msgs ?? []) {
      for (const p of String(m.content || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)) {
        if (p.length < 4 || STOPWORDS.has(p)) continue
        freq[p] = (freq[p] ?? 0) + 1
      }
    }
    termos = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t)
  }

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={T.h1}>Conversas</h1>
          <p style={{ ...T.sub, marginTop: 4 }}>Acompanhe todos os atendimentos do seu agente, veja conversas em aberto e identifique oportunidades.</p>
        </div>
        <LimparHistorico />
      </div>
      <ConversasCentral conversas={all} termos={termos} />
    </div>
  )
}
