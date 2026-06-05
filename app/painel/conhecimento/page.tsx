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
    <div className="animate-slide-up" style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={T.h1}>Conhecimento</h1>
        <p style={{ ...T.sub, marginTop: 4 }}>
          Fatos sobre o seu negócio que o agente usa nas respostas — horários, políticas, preços, prazos.
          Adicione e edite à vontade; vale na próxima conversa.
        </p>
      </div>
      <KnowledgeManager agentId={agent.id} />
    </div>
  )
}
