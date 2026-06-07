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
        classificacao_geral: { type: 'string', description: 'Classificação geral curta. Ex: "Positiva", "Neutra com atenção", "Negativa".' },
        resumo: { type: 'string', description: 'Resumo executivo do clima de satisfação (2-4 frases), com a principal recomendação.' },
        sentimento: {
          type: 'object', description: 'Quantas conversas tiveram cada sentimento.',
          properties: { positivo: { type: 'integer' }, neutro: { type: 'integer' }, negativo: { type: 'integer' } },
          required: ['positivo', 'neutro', 'negativo'],
        },
        elogios: {
          type: 'array', description: 'Momentos de satisfação/elogio dos clientes.',
          items: { type: 'object', properties: { contato: { type: 'string' }, resumo: { type: 'string' }, conversation_id: { type: 'string' } }, required: ['resumo'] },
        },
        reclamacoes: {
          type: 'array', description: 'Insatisfações/reclamações dos clientes.',
          items: { type: 'object', properties: {
            titulo: { type: 'string', description: 'Título curto da reclamação' },
            contato: { type: 'string' }, tema: { type: 'string', description: 'Tema (ex: Agendamento, Preço, Atendimento)' },
            sentimento: { type: 'string', description: 'Ex: Frustração leve, Insatisfação' },
            severidade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
            resumo: { type: 'string' }, acao: { type: 'string', description: 'Ação recomendada' }, conversation_id: { type: 'string' },
          }, required: ['resumo', 'severidade'] },
        },
        pontos_atencao: {
          type: 'array', description: 'Conversas que não são reclamações diretas mas indicam risco (dúvida persistente, muitas mensagens, informação divergente).',
          items: { type: 'object', properties: {
            tema: { type: 'string' }, risco: { type: 'string', description: 'Ex: Risco de frustração, Dificuldade de resolução' },
            resumo: { type: 'string' }, acao: { type: 'string' }, conversation_id: { type: 'string' },
          }, required: ['resumo'] },
        },
        temas: {
          type: 'array', description: 'Principais temas ligados à satisfação, com nº de menções.',
          items: { type: 'object', properties: { tema: { type: 'string' }, n: { type: 'integer' } }, required: ['tema'] },
        },
        recomendacoes: { type: 'array', description: 'Recomendações práticas para melhorar a satisfação.', items: { type: 'string' } },
      },
      required: ['satisfacao_media', 'resumo', 'elogios', 'reclamacoes', 'sentimento'],
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
          'Estime uma nota média de 1 a 5 e a classificação geral. Distribua as conversas em sentimento positivo/neutro/negativo (a soma deve bater com o total). Identifique elogios, reclamações (com título, tema, sentimento, severidade e ação recomendada), pontos de atenção (riscos), os principais temas com contagem e recomendações práticas. O canal é sempre WhatsApp. Use o conversation_id exatamente como aparece. Não invente; listas vazias quando não houver.',
          '', blocos,
        ].join('\n'),
      }],
    })
    const block = resp.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!block) throw new Error('sem retorno')
    const a = block.input as any
    const sent = a.sentimento || {}
    return NextResponse.json({
      report: {
        satisfacao_media: Math.max(1, Math.min(5, Number(a.satisfacao_media) || 0)),
        classificacao_geral: a.classificacao_geral ?? '',
        resumo: a.resumo ?? '',
        sentimento: { positivo: Number(sent.positivo || 0), neutro: Number(sent.neutro || 0), negativo: Number(sent.negativo || 0) },
        elogios: a.elogios ?? [],
        reclamacoes: a.reclamacoes ?? [],
        pontos_atencao: a.pontos_atencao ?? [],
        temas: a.temas ?? [],
        recomendacoes: a.recomendacoes ?? [],
        conversas: lista.length,
        period_days: periodDays,
      },
    })
  } catch (e: any) {
    console.error('[avaliacoes]', e?.message)
    return NextResponse.json({ error: 'Falha ao avaliar. Tente novamente.' }, { status: 502 })
  }
}
