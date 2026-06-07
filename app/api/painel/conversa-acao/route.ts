import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Ações do cliente sobre uma conversa do próprio agente (verifica posse e usa service role)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { conversation_id, action } = await req.json().catch(() => ({}))
  if (!conversation_id || !action) return NextResponse.json({ error: 'Dados incompletos.' }, { status: 400 })

  // Confirma que a conversa pertence ao agente do cliente
  const { data: conversa } = await supabase
    .from('conversations').select('id, agents!inner(client_id)')
    .eq('id', conversation_id).eq('agents.client_id', user.id).single()
  if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })

  const admin = createAdminClient()
  let patch: Record<string, unknown> = {}
  if (action === 'finalizar') patch = { status: 'resolved', ended_at: new Date().toISOString() }
  else if (action === 'reabrir') patch = { status: 'open', ended_at: null }
  else if (action === 'marcar_lead') patch = { lead_status: 'qualificado', lead_reason: 'Marcado manualmente pela equipe', lead_updated_at: new Date().toISOString() }
  else return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })

  const { error } = await admin.from('conversations').update(patch).eq('id', conversation_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, patch })
}
