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

    const { agent_id } = await req.json()
    if (!agent_id) return NextResponse.json({ error: 'agent_id obrigatório.' }, { status: 400 })

    const admin = createAdminClient()

    // 2. Busca IDs das conversas do agente
    const { data: conversas } = await admin
      .from('conversations')
      .select('id')
      .eq('agent_id', agent_id)

    const convIds = (conversas ?? []).map(c => c.id)

    // 3. Deleta mensagens das conversas (se houver)
    if (convIds.length > 0) {
      await admin.from('messages').delete().in('conversation_id', convIds)
    }

    // 4. Deleta conversas
    await admin.from('conversations').delete().eq('agent_id', agent_id)

    // 5. Deleta métricas
    await admin.from('metrics').delete().eq('agent_id', agent_id)

    // 6. Deleta o agente
    const { error } = await admin.from('agents').delete().eq('id', agent_id)
    if (error) {
      console.error('[delete-agent]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('[delete-agent] erro inesperado:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
