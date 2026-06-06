import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/apiAuth'
import { logAction } from '@/lib/audit'

export const maxDuration = 90

const MODEL = 'claude-sonnet-4-5'
const MAX_CONVERSAS = 40
const MAX_MSGS_POR_CONVERSA = 14
const MAX_CHARS_MSG = 400

// GET — devolve a última análise salva do escopo pedido
export async function GET(req: NextRequest) {
  const { error: authError } = await requireAdmin()
  if (authError) return authError

  const supabase = await createClient()
  const clientId = new URL(req.url).searchParams.get('client_id')
  const scope = clientId || 'global'

  const { data } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('scope', scope)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  return NextResponse.json({ insight: data ?? null })
}

// POST — roda a análise de IA e salva
export async function POST(req: NextRequest) {
  const { ctx, error: authError } = await requireAdmin({ write: true })
  if (authError) return authError

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servidor sem chave de IA configurada.' }, { status: 500 })

  const body = await req.json().catch(() => ({}))
  const clientId: string | null = body.client_id || null
  const periodDays: number = Math.min(Math.max(Number(body.period_days) || 7, 1), 90)
  const scope = clientId || 'global'

  const admin = createAdminClient()
  const desde = new Date(Date.now() - periodDays * 86400000).toISOString()

  // 1. Conversas do período (filtra por cliente se pedido)
  let convQuery = admin
    .from('conversations')
    .select('id, contact_identifier, status, started_at, agents!inner(name, client_id, profiles(company_name))')
    .gte('started_at', desde)
    .order('started_at', { ascending: false })
    .limit(MAX_CONVERSAS)
  if (clientId) convQuery = convQuery.eq('agents.client_id', clientId)

  const { data: conversas } = await convQuery
  const lista = conversas ?? []

  if (!lista.length) {
    return NextResponse.json({ error: 'Nenhuma conversa no período selecionado para analisar.' }, { status: 400 })
  }

  // 2. Mensagens de cada conversa (compactadas)
  const convIds = lista.map((c: any) => c.id)
  const { data: msgs } = await admin
    .from('messages')
    .select('conversation_id, role, content, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: true })

  const porConversa: Record<string, any[]> = {}
  for (const m of msgs ?? []) {
    (porConversa[m.conversation_id] ??= []).push(m)
  }

  // 3. Monta o texto enviado ao modelo (econômico)
  const blocos = lista.map((c: any) => {
    const empresa = c.agents?.profiles?.company_name ?? 'Sem cliente'
    const agente = c.agents?.name ?? '—'
    const todas = porConversa[c.id] ?? []
    const recortadas = todas.slice(-MAX_MSGS_POR_CONVERSA)
    const linhas = recortadas.map(m => {
      const quem = m.role === 'user' ? 'Cliente' : 'Agente'
      const txt = String(m.content || '').slice(0, MAX_CHARS_MSG)
      return `${quem}: ${txt}`
    }).join('\n')
    return `### Conversa ${c.id}\nCliente Bonsync: ${empresa} | Agente: ${agente} | Status: ${c.status}\n${linhas || '(sem mensagens)'}`
  }).join('\n\n')

  const escopoTxt = clientId
    ? `do cliente selecionado`
    : `de todos os clientes da plataforma`

  const tool: Anthropic.Tool = {
    name: 'registrar_analise',
    description: 'Registra a análise estruturada das conversas.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: 'Resumo executivo (3-6 frases) do período: volume, clima geral, principais pontos.' },
        complaints: {
          type: 'array', description: 'Reclamações ou insatisfações de clientes finais detectadas.',
          items: { type: 'object', properties: {
            cliente: { type: 'string', description: 'Cliente Bonsync (empresa) da conversa' },
            resumo: { type: 'string', description: 'O que o cliente final reclamou, em 1 frase' },
            severidade: { type: 'string', enum: ['alta', 'media', 'baixa'] },
            conversation_id: { type: 'string' },
          }, required: ['cliente', 'resumo', 'severidade'] },
        },
        opportunities: {
          type: 'array', description: 'Oportunidades de venda/upsell percebidas e não aproveitadas pelo agente.',
          items: { type: 'object', properties: {
            cliente: { type: 'string' },
            resumo: { type: 'string', description: 'A oportunidade, em 1 frase' },
            conversation_id: { type: 'string' },
          }, required: ['cliente', 'resumo'] },
        },
        failures: {
          type: 'array', description: 'Falhas do agente de IA: respostas erradas, sem resposta, confusas, ou escalonamentos que poderiam ser evitados.',
          items: { type: 'object', properties: {
            cliente: { type: 'string' },
            agente: { type: 'string' },
            resumo: { type: 'string', description: 'A falha, em 1 frase' },
            conversation_id: { type: 'string' },
          }, required: ['cliente', 'resumo'] },
        },
      },
      required: ['summary', 'complaints', 'opportunities', 'failures'],
    },
  }

  const anthropic = new Anthropic({ apiKey })

  let analise: any
  try {
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 2000,
      tool_choice: { type: 'tool', name: 'registrar_analise' },
      tools: [tool],
      messages: [{
        role: 'user',
        content: [
          `Você é analista de operações da Bonsync (agentes de IA no WhatsApp). Analise as conversas abaixo ${escopoTxt}, dos últimos ${periodDays} dias.`,
          'Identifique reclamações de clientes finais, oportunidades de venda não aproveitadas e falhas do agente de IA. Seja específico e cite o cliente Bonsync correto de cada item. Não invente itens: se uma categoria não tiver nada relevante, devolva lista vazia.',
          'Use o campo conversation_id exatamente como aparece em cada bloco "### Conversa <id>".',
          '',
          blocos,
        ].join('\n'),
      }],
    })
    const block = resp.content.find(b => b.type === 'tool_use') as Anthropic.ToolUseBlock | undefined
    if (!block) throw new Error('Modelo não retornou análise estruturada.')
    analise = block.input
  } catch (e: any) {
    console.error('[analise]', e?.message)
    return NextResponse.json({ error: 'Falha ao analisar com a IA. Tente novamente.' }, { status: 502 })
  }

  const stats = {
    conversas: lista.length,
    reclamacoes: analise.complaints?.length ?? 0,
    oportunidades: analise.opportunities?.length ?? 0,
    falhas: analise.failures?.length ?? 0,
  }

  // 4. Salva a análise
  const { data: saved, error: e2 } = await admin.from('ai_insights').insert({
    scope,
    client_id: clientId,
    period_days: periodDays,
    summary: analise.summary ?? '',
    complaints: analise.complaints ?? [],
    opportunities: analise.opportunities ?? [],
    failures: analise.failures ?? [],
    stats,
  }).select('*').single()

  if (e2) return NextResponse.json({ error: e2.message }, { status: 400 })

  await logAction(ctx!.actor, 'ai.analyze', { entity: 'insights', entityId: scope, details: { ...stats, period_days: periodDays } })
  return NextResponse.json({ insight: saved })
}
