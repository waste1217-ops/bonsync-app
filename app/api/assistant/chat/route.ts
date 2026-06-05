import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { copilotoTools, runCopilotoTool } from '@/lib/copilotoTools'

export const maxDuration = 60

interface Attachment {
  kind: 'text' | 'pdf' | 'image'
  name: string
  text?: string
  data?: string
  media_type?: string
}
interface ChatMsg { role: 'user' | 'assistant'; content: string }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('company_name, role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'
  const TOOLS = copilotoTools(isAdmin)

  let body: { messages?: ChatMsg[]; attachments?: Attachment[] }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 }) }

  const messages    = body.messages    || []
  const attachments = body.attachments || []
  if (messages.length === 0) {
    return NextResponse.json({ error: 'Nenhuma mensagem.' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Servidor sem chave de IA configurada.' }, { status: 500 })
  }

  const empresa = profile?.company_name || 'sua empresa'
  const systemPrompt = (isAdmin ? [
    'Você é o Copiloto da Bonsync no modo ADMINISTRADOR. Tem visão de TODA a plataforma: todos os clientes, agentes, conversas, negócios e finanças.',
    'Use as ferramentas para responder com dados reais. Em negócios e conversas, o campo "cliente_bonsync" indica a QUAL cliente da Bonsync aquele registro pertence — use isso para localizar coisas (ex.: "a Loja Capuccino é um lead do cliente X").',
    'Ferramentas de admin: listar_clientes (carteira) e consultar_financeiro (MRR/ARR).',
  ] : [
    `Você é o Copiloto Bonsync, assistente de análise de dados de ${empresa}.`,
    'Use as ferramentas para consultar os dados de atendimento da empresa (conversas, leads, negócios do WhatsApp) e responda com números reais.',
  ]).concat([
    'O usuário também pode anexar arquivos (planilhas, PDFs) com dados históricos ou de fora do WhatsApp — combine as fontes quando fizer sentido.',
    'IMPORTANTE: você é SOMENTE LEITURA. Nunca afirme que alterou, criou ou apagou algo — você apenas analisa e relata.',
    'Responda sempre em português brasileiro, de forma clara e objetiva. Use tabelas, listas e destaques.',
    'Se um dado não existir nas ferramentas nem nos arquivos, diga isso com honestidade — não invente.',
  ]).join('\n')

  // Monta o histórico. Os anexos vão na ÚLTIMA mensagem do usuário (reenviados a cada turno
  // para manter o contexto disponível em perguntas de acompanhamento).
  const anthropicMessages: Anthropic.MessageParam[] = []

  messages.forEach((m, i) => {
    const isLastUser = i === messages.length - 1 && m.role === 'user'
    if (isLastUser && attachments.length > 0) {
      const blocks: Anthropic.ContentBlockParam[] = []
      for (const a of attachments) {
        if (a.kind === 'text' && a.text) {
          blocks.push({ type: 'text', text: `Arquivo "${a.name}":\n\n${a.text}` })
        } else if (a.kind === 'pdf' && a.data) {
          blocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: a.data } })
        } else if (a.kind === 'image' && a.data && a.media_type) {
          blocks.push({ type: 'image', source: { type: 'base64', media_type: a.media_type as any, data: a.data } })
        }
      }
      blocks.push({ type: 'text', text: m.content })
      anthropicMessages.push({ role: 'user', content: blocks })
    } else {
      anthropicMessages.push({ role: m.role, content: m.content })
    }
  })

  try {
    const client = new Anthropic({ apiKey, timeout: 55000, maxRetries: 1 })
    let totalIn = 0, totalOut = 0
    let response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      system: systemPrompt,
      tools: TOOLS,
      messages: anthropicMessages,
    })
    totalIn += response.usage?.input_tokens ?? 0
    totalOut += response.usage?.output_tokens ?? 0

    // Loop de uso de ferramentas (máx 5 rodadas por segurança)
    let rodadas = 0
    while (response.stop_reason === 'tool_use' && rodadas < 5) {
      rodadas++
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = await runCopilotoTool(supabase, block.name, block.input, isAdmin)
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }
      }
      anthropicMessages.push({ role: 'assistant', content: response.content })
      anthropicMessages.push({ role: 'user', content: toolResults })

      response = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOLS,
        messages: anthropicMessages,
      })
      totalIn += response.usage?.input_tokens ?? 0
      totalOut += response.usage?.output_tokens ?? 0
    }

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('\n')
      .trim()

    return NextResponse.json({
      reply: text || 'Não consegui gerar uma resposta. Pode reformular?',
      usage: { input_tokens: totalIn, output_tokens: totalOut },
    })
  } catch (err: any) {
    console.error('[assistant/chat] erro:', err.message)
    return NextResponse.json({ error: 'Erro ao processar. Tente novamente.' }, { status: 500 })
  }
}
