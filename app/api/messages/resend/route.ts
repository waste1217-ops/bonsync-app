import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendText } from '@/lib/evolution'

function mapSendError(err: any): string {
  const m = String(err?.message || '').match(/Evolution API (\d+)/)
  const s = m ? Number(m[1]) : 0
  if (s === 401 || s === 403) return 'Token inválido ou sem permissão'
  if (s === 404) return 'Instância/canal não encontrado (desconectado)'
  if (s === 400) return 'Número inválido ou requisição rejeitada'
  if (s === 500) return 'Sessão do WhatsApp instável — reconecte a instância no painel admin'
  if (!s) return 'WhatsApp API indisponível (timeout ou conexão)'
  return `Erro ${s} da API do WhatsApp`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { message_id } = await req.json().catch(() => ({}))
  if (!message_id) return NextResponse.json({ error: 'message_id obrigatório.' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  const admin = createAdminClient()
  const { data: msg } = await admin
    .from('messages')
    .select('id, content, role, conversations!inner(contact_identifier, agents!inner(client_id, status, config))')
    .eq('id', message_id).single()
  if (!msg) return NextResponse.json({ error: 'Mensagem não encontrada.' }, { status: 404 })

  const conv: any = (msg as any).conversations
  const agent: any = conv?.agents
  if (!isAdmin && agent?.client_id !== user.id) return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 })
  if (msg.role !== 'assistant') return NextResponse.json({ error: 'Só é possível reenviar respostas do agente.' }, { status: 400 })

  const instance = agent?.config?.whatsapp_instance
  if (!instance) return NextResponse.json({ error: 'Agente sem instância de WhatsApp configurada.' }, { status: 400 })

  await admin.from('messages').update({ send_status: 'enviando', send_error: null }).eq('id', message_id)
  try {
    await sendText(instance, conv.contact_identifier, msg.content)
    await admin.from('messages').update({ send_status: 'enviada', send_error: null }).eq('id', message_id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    const motivo = mapSendError(err)
    await admin.from('messages').update({ send_status: 'falha', send_error: motivo }).eq('id', message_id)
    return NextResponse.json({ error: motivo }, { status: 502 })
  }
}
