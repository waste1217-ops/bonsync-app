import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { PlaygroundPanel } from './PlaygroundPanel'

export const dynamic = 'force-dynamic'

export default async function AdminPlaygroundPage() {
  const supabase = await createClient()
  const { data: agentes } = await supabase
    .from('agents')
    .select('id, name, config, profiles(company_name)')
    .order('created_at', { ascending: false })

  const lista = (agentes ?? []).map((a: any) => ({
    id: a.id,
    nome: a.name,
    empresa: a.profiles?.company_name ?? '—',
    model: a.config?.model ?? 'claude-sonnet-4-5',
    prompt: a.config?.prompt ?? '',
  }))

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={T.h1}>Playground</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          Teste prompts e modelos sem afetar a produção. Nada aqui é salvo nem enviado a clientes.
        </p>
      </div>
      <PlaygroundPanel agentes={lista} />
    </div>
  )
}
