import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 45

// Resumo on-demand de uma conversa do próprio cliente. Não grava nada.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { conversation_id } = await req.json().catch(() => ({}))
  if (!conversation_id) return NextResponse.json({ error: 'conversation_id obrigatório.' }, { status: 400 })

  // Garante que a conversa pertence ao agente do cliente (RLS já protege, validamos de novo)
  const { data: conversa } = await supabase
    .from('conversations')
    .select('id, agents!inner(client_id)')
    .eq('id', conversation_id)
    .eq('agents.client_id', user.id)
    .single()
  if (!conversa) return NextResponse.json({ error: 'Conversa não encontrada.' }, { status: 404 })

  const { data: msgs } = await supabase
    .from('messages').select('role, content')
    .eq('conversation_id', conversation_id)
    .order('created_at', { ascending: true })
    .limit(60)

  if (!msgs?.length) return NextResponse.json({ error: 'Conversa sem mensagens para resumir.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servidor sem chave de IA.' }, { status: 500 })

  const texto = msgs.map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${String(m.content).slice(0, 800)}`).join('\n')

  const anthropic = new Anthropic({ apiKey })
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: 'Você resume conversas de atendimento em português do Brasil, de forma clara e útil para o dono do negócio.',
      messages: [{
        role: 'user',
        content: `Resuma esta conversa em tópicos curtos cobrindo: (1) o que o cliente queria, (2) como foi resolvido, (3) próximos passos ou pendências, (4) se há oportunidade de venda. Seja objetivo.\n\n${texto}`,
      }],
    })
    const out = resp.content.filter(b => b.type === 'text').map((b: any) => b.text).join('\n').trim()
    return NextResponse.json({ summary: out || 'Não foi possível resumir.' })
  } catch (e: any) {
    console.error('[resumo-conversa]', e?.message)
    return NextResponse.json({ error: 'Falha ao gerar resumo.' }, { status: 502 })
  }
}
