import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'

export async function POST(req: NextRequest) {
  const { ctx, error: authError } = await requireAdmin({ write: true })
  if (authError) return authError

  const { agent_id } = await req.json()
  if (!agent_id) return NextResponse.json({ error: 'agent_id obrigatório.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: original, error: e1 } = await admin.from('agents').select('*').eq('id', agent_id).single()
  if (e1 || !original) return NextResponse.json({ error: 'Agente não encontrado.' }, { status: 404 })

  // Cópia da config, mas sem a instância (evita conflito de webhook/instância)
  const novaConfig = { ...(original.config || {}) }
  delete (novaConfig as any).whatsapp_instance

  const { data: novo, error: e2 } = await admin.from('agents').insert({
    client_id: original.client_id,
    name: `Cópia de ${original.name}`,
    description: original.description,
    status: 'paused', // começa desativado para evitar uso acidental
    config: novaConfig,
  }).select('id').single()

  if (e2 || !novo) return NextResponse.json({ error: e2?.message || 'Falha ao duplicar.' }, { status: 400 })

  await logAction(ctx!.actor, 'agent.duplicate', { entity: 'agent', entityId: novo.id, details: { origem: original.name } })
  return NextResponse.json({ success: true, id: novo.id })
}
