import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

  const { client_id } = await req.json()
  if (!client_id) return NextResponse.json({ error: 'client_id obrigatório.' }, { status: 400 })

  // Admin não pode deletar a si mesmo
  if (client_id === user.id) return NextResponse.json({ error: 'Não é possível deletar o próprio admin.' }, { status: 400 })

  const admin = createAdminClient()

  // Busca os agentes do cliente para deletar dados relacionados
  const { data: agentes } = await admin.from('agents').select('id').eq('client_id', client_id)
  const agentIds = agentes?.map(a => a.id) ?? []

  if (agentIds.length > 0) {
    // Deleta mensagens das conversas dos agentes
    const { data: convs } = await admin.from('conversations').select('id').in('agent_id', agentIds)
    const convIds = convs?.map(c => c.id) ?? []
    if (convIds.length > 0) {
      await admin.from('messages').delete().in('conversation_id', convIds)
    }
    await admin.from('conversations').delete().in('agent_id', agentIds)
    await admin.from('metrics').delete().in('agent_id', agentIds)
    await admin.from('agents').delete().eq('client_id', client_id)
  }

  // Deleta profile
  await admin.from('profiles').delete().eq('id', client_id)

  // Deleta usuário do Supabase Auth (service role obrigatório)
  const { error } = await admin.auth.admin.deleteUser(client_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ success: true })
}
