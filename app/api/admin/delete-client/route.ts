import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(req: NextRequest) {
  try {
    // 1. Verifica admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })

    const { client_id } = await req.json()
    if (!client_id) return NextResponse.json({ error: 'client_id obrigatório.' }, { status: 400 })
    if (client_id === user.id) return NextResponse.json({ error: 'Não é possível excluir o próprio admin.' }, { status: 400 })

    const admin = createAdminClient()

    // 2. Busca agentes do cliente
    const { data: agentes } = await admin.from('agents').select('id').eq('client_id', client_id)
    const agentIds = (agentes ?? []).map(a => a.id)

    // 3. Para cada agente, deleta dados relacionados
    if (agentIds.length > 0) {
      // Busca conversas de todos os agentes
      const { data: conversas } = await admin
        .from('conversations')
        .select('id')
        .in('agent_id', agentIds)

      const convIds = (conversas ?? []).map(c => c.id)

      // Deleta mensagens
      if (convIds.length > 0) {
        await admin.from('messages').delete().in('conversation_id', convIds)
      }

      // Deleta conversas, métricas e agentes
      await admin.from('conversations').delete().in('agent_id', agentIds)
      await admin.from('metrics').delete().in('agent_id', agentIds)
      await admin.from('agents').delete().eq('client_id', client_id)
    }

    // 4. Deleta profile
    await admin.from('profiles').delete().eq('id', client_id)

    // 5. Deleta usuário do Auth (service role)
    const { error } = await admin.auth.admin.deleteUser(client_id)
    if (error) {
      console.error('[delete-client]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[delete-client] erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
