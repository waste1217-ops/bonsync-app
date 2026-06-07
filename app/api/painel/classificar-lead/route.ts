import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 30

// Classifica a intenção de compra de UMA conversa sob demanda (cliente)
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { conversation_id } = await req.json().catch(() => ({}))
  if (!conversation_id) return NextResponse.json({ error: 'conversation_id obrigatório.' }, { status: 400 })

  const { data: conversa } = await supabase
    .from('conversations').select('id, agents!inner(client_id)')
    .eq('id', conversation_id).eq('agents.client_id', user.id).single()
  if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })

  const { data: msgs } = await supabase.from('messages').select('role, content')
    .eq('conversation_id', conversation_id).order('created_at', { ascending: true }).limit(40)
  if (!msgs?.length) return NextResponse.json({ error: 'Conversa sem mensagens para classificar.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servidor sem chave de IA.' }, { status: 500 })

  const convo = msgs.slice(-12).map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${String(m.content).slice(0, 400)}`).join('\n')
  const anthropic = new Anthropic({ apiKey })
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', max_tokens: 120,
      system: [
        'Classifique a INTENÇÃO DE COMPRA do contato com base na conversa.',
        '- curioso: só pesquisando, sem intenção clara.',
        '- potencial: interesse real, ainda decidindo.',
        '- qualificado: alta intenção (quer comprar/orçamento/agendar/dados/humano).',
        'Responda EXATAMENTE: status|motivo curto (máx 8 palavras).',
      ].join('\n'),
      messages: [{ role: 'user', content: convo }],
    })
    const out = (resp.content[0] && resp.content[0].type === 'text' ? (resp.content[0] as any).text : '').trim()
    const [s, ...rest] = out.split('|')
    const status = (s || '').trim().toLowerCase()
    if (!['curioso', 'potencial', 'qualificado'].includes(status)) return NextResponse.json({ error: 'Não foi possível classificar.' }, { status: 502 })
    const reason = rest.join('|').trim().slice(0, 120)
    const admin = createAdminClient()
    await admin.from('conversations').update({ lead_status: status, lead_reason: reason, lead_updated_at: new Date().toISOString() }).eq('id', conversation_id)
    return NextResponse.json({ success: true, lead_status: status, lead_reason: reason })
  } catch (e: any) {
    console.error('[classificar-lead]', e?.message)
    return NextResponse.json({ error: 'Falha ao classificar.' }, { status: 502 })
  }
}
