import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { InteligenciaPanel } from './InteligenciaPanel'

export const dynamic = 'force-dynamic'

export default async function AdminInteligenciaPage() {
  const supabase = await createClient()

  const [{ data: clientes }, { data: ultima }] = await Promise.all([
    supabase.from('profiles').select('id, company_name, email').eq('role', 'client').order('company_name'),
    supabase.from('ai_insights').select('*').eq('scope', 'global').order('created_at', { ascending: false }).limit(1).single(),
  ])

  const lista = (clientes ?? []).map((c: any) => ({ id: c.id, nome: c.company_name || c.email }))

  return (
    <div className="animate-slide-up" style={{ maxWidth: 920 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>IA para gestão</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          Análise automática das conversas: reclamações, oportunidades de venda e falhas do agente.
        </p>
      </div>
      <InteligenciaPanel clientes={lista} initial={ultima ?? null} />
    </div>
  )
}
