import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { agent_id } = await req.json()
  if (!agent_id) return NextResponse.json({ error: 'agent_id obrigatório.' }, { status: 400 })

  const admin = createAdminClient()

  // Deleta mensagens → conversas → agente (cascade via FK, mas explicitamos por segurança)
  await admin.from('messages').delete().in('conversation_id',
    admin.from('conversations').select('id').eq('agent_id', agent_id) as any
  )
  await admin.from('conversations').delete().eq('agent_id', agent_id)
  await admin.from('metrics').delete().eq('agent_id', agent_id)
  const { error } = await admin.from('agents').delete().eq('id', agent_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
