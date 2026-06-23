import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit'

const JANELAS: Record<string, { ms: number | null; label: string }> = {
  '24h':    { ms: 86400000,      label: '24 horas' },
  'semana': { ms: 7 * 86400000,  label: '1 semana' },
  'mes':    { ms: 30 * 86400000, label: '1 mês' },
  'tudo':   { ms: null,          label: 'todo o histórico' },
}

/**
 * Limpa o histórico de conversas DO PRÓPRIO cliente, no período selecionado.
 * Verifica a posse pela sessão e executa a exclusão via service-role (a tabela
 * não tem policy de DELETE para o cliente). Mensagens são removidas em cascata.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { period } = await req.json().catch(() => ({}))
  const janela = JANELAS[period]
  if (!janela) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })

  // Só pode apagar conversas do próprio agente
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user.id).single()
  if (!agent) return NextResponse.json({ error: 'Nenhum agente encontrado para esta conta.' }, { status: 404 })

  const admin = createAdminClient()
  let q = admin.from('conversations').delete().eq('agent_id', agent.id)
  if (janela.ms !== null) q = q.gte('started_at', new Date(Date.now() - janela.ms).toISOString())

  const { data: removidas, error } = await q.select('id')
  if (error) {
    console.error('[limpar-historico]', error.message)
    return NextResponse.json({ error: 'Não foi possível apagar o histórico. Tente novamente.' }, { status: 500 })
  }

  const count = removidas?.length ?? 0
  // Registro administrativo — sem armazenar o conteúdo das conversas apagadas
  await logAction({ id: user.id, email: user.email ?? null }, 'historico.clear', {
    entity: 'client', entityId: user.id,
    details: { period, periodLabel: janela.label, deleted: count },
  })

  return NextResponse.json({ success: true, deleted: count, periodLabel: janela.label })
}
