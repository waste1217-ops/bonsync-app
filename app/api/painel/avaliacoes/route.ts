import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 90

const MAX_CONVERSAS = 40
const MAX_MSGS = 12
const MAX_CHARS = 350

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: agent } = await supabase.from('agents').select('id').eq('client_id', user.id).single()
  if (!agent) return NextResponse.json({ error: 'Nenhum agente configurado.' }, { status: 400 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servidor sem chave de IA.' }, { status: 500 })

  const periodDays = Math.min(Math.max(Number((await req.json().catch(() => ({}))).period_days) || 30, 1), 90)
  const desde = new Date(Date.now() - periodDays * 86400000).toISOString()

  const { data: convs } = await supabase
    .from('conversations').select('id, contact_identifier, started_at')
    .eq('agent_id', agent.id).gte('started_at', desde)
    .order('started_at', { ascending: false }).limit(MAX_CONVERSAS)
  const lista = convs ?? []
  if (!lista.length) return NextResponse.json({ error: 'Sem conversas no período para avaliar.' }, { status: 400 })

  const ids = lista.map(c => c.id)
  const { data: msgs } = await supabase
    .from('messages').select('conversation_id, role, content, created_at')
    .in('conversation_id', ids).order('conversation_id', { ascending: true }).order('created_at', { ascending: true })

  const porConv: Record<string, any[]> = {}
  for (const m of msgs ?? []) (porConv[m.conversation_id] ??= []).push(m)

  const blocos = lista.map(c => {
    const ms = (porConv[c.id] ?? []).slice(-MAX_MSGS)
      .map(m => `${m.role === 'user' ? 'Cliente' : 'Agente'}: ${String(m.content).slice(0, MAX_CHARS)}`).join('\n')
    return `### Conversa ${c.id} (contato: ${c.contact_identifier || 'anônimo'})\n${ms || '(sem mensagens)'}`
  }).join('\n\n')

  const tool: Anthropic.Tool = {
    name: 'registrar_avaliacao',
    description: 'Registra a avaliação de satisfação das conversas.',
    input_schema: {
      type: 'object',
      properties: {
        satisfacao_media: { type: 'number', description: 'Nota média estimada de satisfação dos clientes, de 1 a 5.' },
        resumo: { type: 'string', description: 'Resumo do clima geral do atendimento (2-4 frases).' },
        elogios: {
          type: 'array', description: 'Momentos de satisfação/elogio dos clientes.',
          items: { type: 'object', properties: {
            contato: { type: 'string' }, resumo: { type: 'string' }, conversation_id: { type: 'string' },
          }, required: ['resumo'] },
        },
        reclamacoes: {
          type: 'array', description: 'Insatisfações/reclamações dos clientes.',
          items: { type: 'object', properties: {
            contato: { type: 'string' }, resumo: { type: 'string' },
            severidade: { type: 'string', enum: ['alta', 'media', 'baixa'] }, conversation_id: { type: 'string' },
          }, required: ['resumo', 'severidade'] },
        },
      },
      required: ['satisfacao_media', 'resumo', 'elogios', 'reclamacoes'],
    },
  }

  const anthropic = new Anthropic({ apiKey })
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1800,
      tool_choice: { type: 'tool', name: 'registrar_avaliacao' },
      tools: [tool],
      messages: [{
        role: 'user',
        content: [
          `Avalie a SATISFAÇÃO dos clientes finais nas conversas de atendimento abaixo (últimos ${periodDays} dias).`,
          'Identifique elogios e reclamações reais e estime uma nota média de 1 a 5. Use o conversation_id exatamente como aparece. Não invente; listas vazias quando não houver.',
          '', blocos,
        ].join('\n'),
      }],
    })
    const block = resp.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!block) throw new Error('sem retorno')
    const a = block.input as any
    return NextResponse.json({
      report: {
        satisfacao_media: Math.max(1, Math.min(5, Number(a.satisfacao_media) || 0)),
        resumo: a.resumo ?? '',
        elogios: a.elogios ?? [],
        reclamacoes: a.reclamacoes ?? [],
        conversas: lista.length,
        period_days: periodDays,
      },
    })
  } catch (e: any) {
    console.error('[avaliacoes]', e?.message)
    return NextResponse.json({ error: 'Falha ao avaliar. Tente novamente.' }, { status: 502 })
  }
}
