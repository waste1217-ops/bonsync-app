import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAction } from '@/lib/audit'

const JANELAS: Record<string, { ms: number | null; label: string }> = {
  '24h':    { ms: 86400000,      label: '24 horas' },
  '7d':     { ms: 7 * 86400000,  label: '7 dias' },
  '30d':    { ms: 30 * 86400000, label: '30 dias' },
  'tudo':   { ms: null,          label: 'todo o histórico' },
}
// Status considerados "histórico" (já encerrados)
const HIST = ['realizada', 'cancelada', 'ausente', 'recusada']

/**
 * Apaga o HISTÓRICO de reuniões do próprio cliente, no período escolhido.
 * Só remove reuniões já encerradas ou cuja data já passou — NUNCA agendamentos
 * futuros. Não toca em conversas, leads, vendas nem em dados de outros clientes.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { period } = await req.json().catch(() => ({}))
  const janela = JANELAS[period]
  if (!janela) return NextResponse.json({ error: 'Período inválido.' }, { status: 400 })

  // Só o agente do próprio cliente
  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user.id).single()
  if (!agent) return NextResponse.json({ error: 'Nenhum agente encontrado para esta conta.' }, { status: 404 })

  const admin = createAdminClient()
  const { data: meetings, error } = await admin
    .from('meetings').select('id, status, start_at, created_at').eq('agent_id', agent.id)
  if (error) {
    if (String(error.message).includes('does not exist')) return NextResponse.json({ success: true, deleted: 0, periodLabel: janela.label })
    console.error('[limpar-reunioes]', error.message)
    return NextResponse.json({ error: 'Não foi possível apagar o histórico de reuniões. Tente novamente.' }, { status: 500 })
  }

  const now = Date.now()
  const cutoff = janela.ms !== null ? now - janela.ms : null
  const ids: string[] = []
  for (const m of meetings ?? []) {
    const startMs = m.start_at ? new Date(m.start_at).getTime() : null
    // histórico = status encerrado OU reunião cuja data já passou
    const isHistory = HIST.includes(m.status) || (startMs !== null && startMs < now)
    if (!isHistory) continue                                   // preserva agendamentos futuros/pendentes
    const eff = startMs ?? (m.created_at ? new Date(m.created_at).getTime() : 0)
    if (cutoff !== null && eff < cutoff) continue              // fora do período
    ids.push(m.id)
  }

  if (ids.length) {
    const { error: delErr } = await admin.from('meetings').delete().in('id', ids).eq('agent_id', agent.id)
    if (delErr) {
      console.error('[limpar-reunioes] delete:', delErr.message)
      return NextResponse.json({ error: 'Não foi possível apagar o histórico de reuniões. Tente novamente.' }, { status: 500 })
    }
  }

  await logAction({ id: user.id, email: user.email ?? null }, 'reunioes.clear', {
    entity: 'client', entityId: user.id, details: { period, periodLabel: janela.label, deleted: ids.length },
  })

  return NextResponse.json({ success: true, deleted: ids.length, ids, periodLabel: janela.label })
}
