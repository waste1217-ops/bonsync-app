import { createClient } from '@/lib/supabase/server'
import { T } from '@/lib/styles'
import { KnowledgeManager } from '@/components/KnowledgeManager'

export default async function ConhecimentoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: agent } = await supabase
    .from('agents').select('id, name').eq('client_id', user!.id).single()

  if (!agent) return (
    <div style={{ textAlign: 'center', padding: '80px 0', ...T.sub }}>
      Nenhum agente configurado. Entre em contato com a Bonsync.
    </div>
  )

  return (
    <div className="animate-slide-up" style={{ maxWidth: 1280 }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={T.h1}>Conhecimento</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          Gerencie as informações que seu agente usa para responder clientes. Aprove sugestões da IA, adicione documentos e mantenha as respostas sempre atualizadas.
        </p>
      </div>
      <KnowledgeManager agentId={agent.id} central />
    </div>
  )
}
